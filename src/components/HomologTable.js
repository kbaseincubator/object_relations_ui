const Component = require('./Component.js')
const h = require('snabbdom/h').default

// components
const { HomologDetails } = require('./HomologDetails')

// utils
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
      'Knowledge Score': (x, y) => {
        const scorex = isNaN(x.knowledge_score) ? 0 : Number(x.knowledge_score)
        const scorey = isNaN(y.knowledge_score) ? 0 : Number(y.knowledge_score)
        return sortBy(scorex, scorey)
      },
      'Source': (x, y) => sortBy(x.source, y.source)
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
            // Get an array of all the KBase workspace IDs for each result
            const ids = data.map(d => d.kbase_id).filter(Boolean)
              .map(toObjKey)
              .map(key => 'wsprov_object/' + key)
            return fetchKnowledgeScores(ids)
          } else {
            return []
          }
        })
        // Fetch knowledge scores from arango for each result
        // Assign the scores into each result object
        .then(resp => {
          if (resp && resp.results && resp.results.length) {
            resp.results.forEach((result, idx) => {
              const score = Number(result.knowledge_score)
              const resultKey = result.key
              this.data.filter(d => toObjKey(d.kbase_id) === resultKey)
                .forEach(d => { d.knowledge_score = score })
            })
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
    return h('p.muted', 'Loading homologs...')
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
    h('h2.mt3', 'Similar Assemblies'),
    h('table.table-lined', [
      h('thead', [
        h('tr', [
          h('th.sticky', ''), // empty table header for plus/minus expand icon
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
  const { dist, namespaceid, sciname, sourceid } = result
  return h('tr', {
    key: sourceid,
    class: {
      expanded: result.expanded,
      expandable: result.details.data.kbase_id
    },
    on: {
      click: () => {
        console.log('result.details', result.details)
        if (result.details.data.kbase_id) {
          result.expanded = !result.expanded
          result.details.fetchReferences()
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
    h('td.bold', [ dist ]),
    h('td', [ sciname || sourceid ]),
    h('td', [
      isNaN(result.knowledge_score) ? '' : result.knowledge_score
    ]),
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
