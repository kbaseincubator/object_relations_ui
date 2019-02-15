const Component = require('./Component.js')
const h = require('snabbdom/h').default
const { fetchHomologs, fetchKnowledgeScores } = require('../utils/apiClients')
const showIf = require('../utils/showIf')
const toObjKey = require('../utils/toObjKey')
const sortBy = require('../utils/sortBy')

module.exports = { HomologTable }

function HomologTable () {
  return Component({
    upa: null,
    data: [],
    currentPage: 1,
    pageSize: 30,
    sortable: { 'Knowledge Score': true },
    sortCol: 'Distance',
    sortDir: 'asc',
    loading: false,
    hasMore: false,
    // Functions for sorting each column in the results
    // see the sortBy function below, and the docs for Array.sort on MDN
    sorters: {
      'Distance': (x, y) => sortBy(Number(x.dist), Number(y.dist)),
      'Name': (x, y) => sortBy(x.sciname || x.sourceid, y.sciname || y.sourceid),
      'Knowledge Score': (x, y) => sortBy(Number(x.knowledge_score), Number(y.knowledge_score)),
      'Source': (x, y) => sortBy(x.source, y.source)
    },
    sortByColumn (colName) {
      const alreadySorting = this.sortCol === colName
      if (alreadySorting && this.sortDir === 'asc') {
        this.sortDir = 'desc'
      } else {
        this.sortDir = 'asc'
        this.sortCol = colName
      }
      if (this.sortCol) {
        let sorter = this.sorters[colName]
        if (this.sortDir === 'desc') sorter = reverse(sorter)
        this.data.sort(sorter)
      }
      this._render()
    },
    nextPage () {
      if (!this.hasMore) return
      this.currentPage += 1
      this.hasMore = (this.currentPage * this.pageSize) < this.data.length
      this._render()
    },
    fetch (upa) {
      this.upa = upa.replace(/:/g, '/')
      this.loading = true
      fetchHomologs(this.upa)
        .then(resp => {
          this.loading = false
          this.currentPage = 1
          if (resp && resp.length) {
            this.data = resp
            this.hasMore = this.data.length > this.pageSize
          } else {
            this.data = []
            this.hasMore = false
          }
          this._render()
          return this.data
        })
        .then(data => {
          if (data && data.length) {
            const ids = data.map(d => d.kbase_id).filter(Boolean)
              .map(toObjKey)
              .map(key => 'wsprov_object/' + key)
            return fetchKnowledgeScores(ids)
          }
        })
        .then(resp => {
          if (resp && resp.results && resp.results.length) {
            resp.results.forEach((score, idx) => {
              this.data[idx].knowledge_score = score
            })
            this._render()
          }
        })
        .catch(err => {
          console.error(err)
          this.loading = false
          this._render()
        })
    },
    view
  })
}

function view () {
  const table = this
  if (table.loading) {
    return h('p.muted', 'Loading homologs...')
  }
  if (!table.data || !table.data.length) {
    return h('div', '')
  }
  const displayedCount = table.currentPage * table.pageSize
  console.log('count', displayedCount)
  const tableRows = []
  for (let i = 0; i < displayedCount && i < table.data.length; ++i) {
    tableRows.push(resultRow(table, table.data[i]))
  }
  return h('div', [
    h('h2.mt3', 'Similar Genomes'),
    h('table.table-lined', [
      h('thead', [
        h('tr', [
          th(table, 'Distance'),
          th(table, 'Name'),
          th(table, 'Knowledge Score'),
          th(table, 'Source')
        ])
      ]),
      h('tbody', tableRows)
    ]),
    showIf(!table.hasMore, () => h('p.muted', 'No more results.')),
    showIf(table.hasMore, () => {
      const remaining = table.data.length - (this.currentPage * this.pageSize)
      return h('div', [
        h('button.btn.mt2', { on: { click: () => table.nextPage() } }, [ 'Load more ' ]),
        h('span.muted.inline-block.ml1', [remaining, ' left'])
      ])
    })
  ])
}

function resultRow (table, result) {
  const { kbase_id: kbaseid, dist, namespaceid, sciname, sourceid } = result
  const href = window._env.kbaseRoot + '/#dataview/' + kbaseid
  return h('tr', [
    h('td.bold', [
      dist
    ]),
    h('td', [
      h('a', { props: { href, target: '_blank' } }, sciname || sourceid)
    ]),
    h('td', [
      isNaN(result.knowledge_score) ? '...' : result.knowledge_score
    ]),
    h('td', [
      namespaceid.replace(/_/g, ' ')
    ])
  ])
}

function th (table, txt) {
  const isSorting = table.sortCol === txt
  return h('th.sortable', {
    class: { sorting: isSorting },
    on: {
      click: () => { table.sortByColumn(txt) }
    }
  }, [
    h('span', [ txt ]),
    showIf(isSorting, () => {
      return h('span.arrow.inline-block.ml1', {
        class: {
          'arrow-down': table.sortDir === 'asc',
          'arrow-up': table.sortDir === 'desc'
        }
      })
    })
  ])
}

function reverse (fn) {
  return function (x, y) {
    const result = fn(x, y)
    return -result
  }
}
