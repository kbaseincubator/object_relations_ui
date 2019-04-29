const Component = require('./Component.js')
const h = require('snabbdom/h').default

// views
const definition = require('./views/definition')

// utils
const { fetchLinkedObjs } = require('../utils/apiClients')
const objHrefs = require('../utils/objHrefs')
const formatDate = require('../utils/formatDate')
const showIf = require('../utils/showIf')
const typeName = require('../utils/typeName')

module.exports = { LinkedDataTable }

function LinkedDataTable (objKey, type, count) {
  return Component({
    type,
    totalCount: count,
    obj_key: objKey,
    data: [],
    page: 0,
    limit: 20,
    loading: false,
    loadingMore: false,
    fetchInitial () {
      // Fetch the initial set of linked data
      this.loading = true
      this.page = 0
      this._render()
      fetchLinkedObjs(objKey, { type, offset: 0, limit: this.limit })
        .then(resp => {
          this.loading = false
          this.data = null
          this.hasMore = false
          if (resp.results && resp.results.length) {
            this.data = resp.results[0]
            if (this.data.length < this.totalCount) {
              this.hasMore = true
            }
          } else if (resp.error) {
            console.error(resp.error)
          }
          this._render()
        })
        .catch(err => {
          console.error(err)
          this.loading = false
          this._render()
        })
    },
    fetchNext () {
      // Fetch the next page of results using an offset
      this.page += 1
      this.loadingMore = true
      this._render()
      const offset = this.page * this.limit
      fetchLinkedObjs(this.obj_key, {
        type: this.type,
        offset,
        limit: this.limit
      })
        .then(resp => {
          if (resp.results) {
            if (resp.results.length && resp.results[0].length) {
              this.data = this.data.concat(resp.results[0])
            } else {
              this.hasMore = false
            }
            if (this.data.length >= this.totalCount) {
              this.hasMore = false
            }
          }
          if (resp.error) {
            console.error(resp.error)
          }
          this.loadingMore = false
          this._render()
        })
        .catch(err => {
          console.error(err)
          this.loadingMore = false
          this._render()
        })
    },
    view
  })
}

function view () {
  if (this.loading) {
    return h('p.muted', 'Loading...')
  }
  if (!this.data || !this.data.length) {
    return h('p.muted', 'No linked data')
  }
  let tableRows = []
  const nCols = 5
  for (let i = 0; i < this.data.length; ++i) {
    const { path, vertex, expanded } = this.data[i]
    let formattedPath = path.vertices.map(v => typeName(v.ws_type))
    formattedPath[0] += ' (this)'
    formattedPath = formattedPath.join(' ⇾ ')
    const dataRow = h('tr.expandable', {
      class: { expanded },
      key: vertex._key,
      on: {
        click: () => {
          this.data[i].expanded = !this.data[i].expanded
          this._render()
        }
      }
    }, [
      h('td', [ h('span.expand-icon', expanded ? '−' : '+') ]),
      h('td', [
        vertex.obj_name
        // h('a', { props: { href: hrefs.obj } }, vertex.obj_name)
      ]),
      h('td', formatDate(vertex.save_date)),
      h('td', [
        vertex.owner
        // h('a', { props: { href: hrefs.owner } }, vertex.owner)
      ]),
      h('td', [
        vertex.narr_name
        // h('a', { props: { href: hrefs.narrative } }, vertex.narr_name)
      ])
    ])
    const hrefs = objHrefs(vertex)
    const detailsRow = h('tr.expandable-sibling', {
      key: vertex._key + '-details',
      class: { 'expanded-sibling': expanded }
    }, [
      h('td', { props: { colSpan: nCols } }, [
        h('div.p1', {
          style: {
            overflow: 'auto',
            whiteSpace: 'normal'
          }
        }, [
          definition('Object', vertex.obj_name, hrefs.obj),
          definition('Save date', formatDate(vertex.save_date)),
          definition('Data type', vertex.ws_type, hrefs.type),
          definition('Narrative', vertex.narr_name, hrefs.narrative),
          definition('Path to object', formattedPath)
        ])
      ])
    ])

    tableRows.push(dataRow)
    tableRows.push(detailsRow)
  }
  return h('div', [
    h('table.table-lined', [
      h('thead', [
        h('tr', [
          h('th.sticky', ''),
          h('th.sticky', 'Name'),
          h('th.sticky', 'Date'),
          h('th.sticky', 'Creator'),
          h('th.sticky', 'Narrative')
        ])
      ]),
      h('tbody', tableRows)
    ]),
    showIf(this.hasMore, () =>
      h('div', [
        h('button.btn.mt2', {
          on: { click: () => this.fetchNext() },
          props: {disabled: this.loadingMore}
        }, [
          showIf(this.loadingMore, 'Loading...'),
          showIf(!this.loadingMore, `Load more`)
        ]),
        h('span.muted.inline-block.ml1', [this.totalCount - this.data.length, ' left'])
      ])
    ),
    showIf(!this.hasMore, () => h('p.muted', 'No more results'))
  ])
}
