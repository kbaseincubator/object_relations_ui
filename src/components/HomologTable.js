const Component = require('./Component.js')
const h = require('snabbdom/h').default

// components
const { HomologDetails } = require('./HomologDetails')

// utils
const { fetchHomologs } = require('../utils/apiClients')
const showIf = require('../utils/showIf')
const sortBy = require('../utils/sortBy')

module.exports = { HomologTable }

function HomologTable () {
  return Component({
    upa: null,
    data: [],
    currentPage: 1,
    pageSize: 30,
    sortable: { 'Knowledge Score': true },
    sortCol: 'ANI Distance',
    sortDir: 'asc',
    loading: false,
    hasMore: false,
    // Functions for sorting each column in the results
    // see the sortBy function below, and the docs for Array.sort on MDN
    sorters: {
      'ANI Distance': (x, y) => sortBy(Number(x.dist), Number(y.dist)),
      'Scientific Name': (x, y) => sortBy(x.sciname || x.sourceid, y.sciname || y.sourceid),
      'Knowledge Score': (x, y) => {
        const scorex = isNaN(x.knowledge_score) ? 0 : Number(x.knowledge_score)
        const scorey = isNaN(y.knowledge_score) ? 0 : Number(y.knowledge_score)
        return sortBy(scorex, scorey)
      },
      Source: (x, y) => sortBy(x.source, y.source)
    },
    // Sort the results by a column
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
    // Advance the page (simply show more data in the dom, no ajax)
    nextPage () {
      if (!this.hasMore) return
      this.currentPage += 1
      this.hasMore = (this.currentPage * this.pageSize) < this.data.length
      this._render()
    },
    // Fetch assembly homology results for a given reads, assembly, or genome object
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
          return this.data
        })
        .then(data => {
          if (data && data.length) {
            // Initialize and assign a HomologDetails component for each result
            data = data.map(d => {
              d.details = HomologDetails(d)
              return d
            })
            this.data = data
            return data
          } else {
            return []
          }
        })
        .catch(err => { console.error(err) })
        .finally(() => {
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
    return h('p.muted', 'Loading..')
  }
  if (!table.data || !table.data.length) {
    return h('div', '')
  }
  const displayedCount = table.currentPage * table.pageSize
  const nCols = 5 // number of columns in the table
  const tableRows = []
  for (let i = 0; i < displayedCount && i < table.data.length; ++i) {
    tableRows.push(resultRow(table, table.data[i]))
    tableRows.push(resultRowDetails(table, table.data[i], nCols))
  }
  return h('div', [
    h('h2.mt3', 'RefSeq Homologs'),
    h('table.table-lined', [
      h('thead', [
        h('tr', [
          h('th.sticky', ''), // empty table header for plus/minus expand icon
          th(table, 'ANI Distance'),
          th(table, 'Scientific Name'),
          th(table, 'Source')
        ])
      ]),
      h('tbody', tableRows)
    ]),
    showIf(!table.hasMore, () => h('p.muted', 'No more results.')),
    showIf(table.hasMore, () => {
      const remaining = table.data.length - (this.currentPage * this.pageSize)
      return h('div', [
        h('button.btn.mt2', { on: { click: () => table.nextPage() } }, ['Load more ']),
        h('span.muted.inline-block.ml1', [remaining, ' left'])
      ])
    })
  ])
}

function resultRow (table, result) {
  const { dist, namespaceid, sciname, sourceid } = result
  return h('tr', {
    key: sourceid,
    class: {
      expanded: result.expanded,
      expandable: result.details.data.kbase_id
    },
    on: {
      click: () => {
        if (result.details.data.kbase_id) {
          result.expanded = !result.expanded
          table._render()
        }
      }
    }
  }, [
    h('td', [
      showIf(result.details.data.kbase_id, () =>
        h('span.expand-icon', result.expanded ? '−' : '+')
      )
    ]),
    h('td.bold', [dist]),
    h('td', [sciname || sourceid]),
    h('td', [
      namespaceid.replace(/_/g, ' ')
    ])
  ])
}

function resultRowDetails (table, result, nCols) {
  return h('tr.expandable-sibling', {
    key: result.sourceid + '-details',
    class: { 'expanded-sibling': result.expanded }
  }, [
    h('td', { props: { colSpan: nCols } }, [
      result.details.view()
    ])
  ])
}

function th (table, txt) {
  const isSorting = table.sortCol === txt
  return h('th.sortable.sticky', {
    class: { sorting: isSorting },
    on: {
      click: () => { table.sortByColumn(txt) }
    }
  }, [
    h('span', [txt]),
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
