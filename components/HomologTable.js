const Component = require('./Component.js')
const h = require('snabbdom/h').default
const { fetchHomologs } = require('../utils/apiClients')
const showIf = require('../utils/showIf')

module.exports = { HomologTable }

function HomologTable () {
  return Component({
    upa: null,
    hiddenData: [],
    displayedData: [],
    currentPage: 0,
    pageSize: 50,
    loading: false,
    hasMore: false,
    nextPage () {
      if (!this.hasMore) return
      const nextPage = this.hiddenData.slice(0, this.pageSize)
      this.displayedData = this.displayedData.concat(nextPage)
      this.hiddenData = this.hiddenData.slice(this.pageSize)
      this.hasMore = this.hiddenData.length > 0
      this.currentPage += 1
      this._render()
    },
    fetch (upa) {
      this.upa = upa.replace(/:/g, '/')
      fetchHomologs(this.upa)
        .then(resp => {
          this.loading = false
          this.currentPage = 0
          if (resp && resp.length) {
            this.displayedData = resp.slice(0, this.pageSize)
            this.hiddenData = resp.slice(this.pageSize)
            this.hasMore = this.hiddenData.length > 0
          } else {
            this.homologs = null
            this.hasMore = false
          }
          this._render()
        })
    },
    view
  })
}

function view () {
  if (!this.displayedData || !this.displayedData.length) {
    return h('p.muted', 'No results')
  }
  return h('div', {
    class: { faded: this.loading }
  }, [
    h('h2.mt3', 'Similar Genomes'),
    h('table.table-lined', [
      h('thead', [
        h('tr', [
          h('th', 'Distance'),
          h('th', 'Name'),
          h('th', 'Source')
        ])
      ]),
      h('tbody', this.displayedData.map(hom => {
        const { kbase_id: kbaseid, dist, namespaceid, sciname, sourceid } = hom
        const href = window._env.kbaseRoot + '/#dataview/' + kbaseid
        return h('tr', [
          h('td.bold', [
            dist
          ]),
          h('td', [
            h('a', { props: { href: href } }, sciname || sourceid)
          ]),
          h('td', [
            namespaceid.replace(/_/g, ' ')
          ])
        ])
      }))
    ]),
    showIf(!this.hasMore, () => h('p.muted', 'No more results.')),
    showIf(this.hasMore, () => h('button.btn.mt2', {
      on: { click: () => this.nextPage() }
    }, [
      'Show more ',
      '(', this.hiddenData.length, ' left)'
    ]))
  ])
}
