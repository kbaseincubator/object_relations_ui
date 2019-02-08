const Component = require('./Component.js')
const h = require('snabbdom/h').default
const { fetchLinkedObjs } = require('../utils/apiClients')
const objHrefs = require('../utils/objHrefs')
const formatDate = require('../utils/formatDate')
const showIf = require('../utils/showIf')

module.exports = { LinkedDataTable }

function LinkedDataTable (objKey, type, count) {
  return Component({
    type,
    totalCount: count,
    obj_key: objKey,
    data: [],
    page: 0,
    limit: 30,
    loading: false,
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
          if (resp.results) {
            this.data = resp.results
            this.hasMore = true
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
            if (resp.results.length === 0) {
              this.hasMore = false
            } else {
              this.data = this.data.concat(resp.results)
            }
            if (this.data.length >= this.totalCount) {
              this.hasMore = false
            }
          } else if (resp.error) {
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
  return h('div', [
    h('table.table-lined', [
      h('thead', [
        h('tr', [
          h('th', 'Name'),
          h('th', 'Date'),
          h('th', 'Creator'),
          h('th', 'Narrative')
        ])
      ]),
      h('tbody', this.data.map(({ path, vertex }) => {
        const hrefs = objHrefs(vertex)
        return h('tr', [
          h('td', [
            h('a', { props: { href: hrefs.obj } }, vertex.obj_name)
          ]),
          h('td', formatDate(vertex.save_date)),
          h('td', [
            h('a', { props: { href: hrefs.owner } }, vertex.owner)
          ]),
          h('td', [
            h('a', { props: { href: hrefs.narrative } }, vertex.narr_name)
          ])
        ])
      }))
    ]),
    showIf(this.hasMore, () =>
      h('button.btn.mt2', {
        on: { click: () => this.fetchNext() },
        props: {disabled: this.loadingMore}
      }, [
        showIf(this.loadingMore, 'Loading...'),
        showIf(!this.loadingMore, `Load more results (${this.totalCount - this.data.length} left)`)
      ])
    ),
    showIf(!this.hasMore, () => h('p.muted', 'No more results'))
  ])
}