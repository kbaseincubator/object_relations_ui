const Component = require('./Component.js')
const h = require('snabbdom/h').default

// utils
const typeName = require('../utils/typeName')
const formatDate = require('../utils/formatDate')
const objHrefs = require('../utils/objHrefs')

// views
const definition = require('./views/definition')

module.exports = { HomologDetails }

// This component appears when a user expands a homolog result to view further details
// `data` is one row in the results fetched in HomologTable.data
function HomologDetails (data) {
  return Component({
    references: {
      fetched: false,
      data: [],
      currentPage: 0,
      pageSize: 10,
      loading: false
    },
    data,
    view
  })
}

function view () {
  const details = this
  const href = window._env.kbaseRoot + '/#dataview/' + details.data.kbase_id
  const ncbiHref = 'https://www.ncbi.nlm.nih.gov/assembly/' + details.data.sourceid
  return h('div.p1', [
    definition('Assembly page', details.data.sciname || details.data.sourceid, href),
    definition('RefSeq page', details.data.sourceid, ncbiHref),
    refTable(details)
  ])
}

function refTable (details) {
  if (details.references.loading) {
    return h('p.p1.muted', 'Loading references...')
  }
  if (!details.references.data || !details.references.data.length) {
    return h('p.p1.muted', 'No additional references found for this result.')
  }
  return h('div.p1', [
    h('h3.h3-5.my1', 'Referencing Objects'),
    h('table.table-lined.table-lined-gray', [
      h('thead', [
        h('tr', [
          h('th', 'Type'),
          h('th', 'Name'),
          h('th', 'Creator'),
          h('th', 'Date')
        ])
      ]),
      h('tbody', details.references.data.map(r => refRow(details, r)))
    ])
  ])
}

function refRow (details, ref) {
  const hrefs = objHrefs(ref)
  return h('tr', {
    key: ref._key
  }, [
    h('td', h('span.bold', typeName(ref.ws_type))),
    h('td', [
      h('a', {
        props: {
          href: hrefs.obj,
          target: '_blank'
        }
      }, [
        ref.obj_name
      ])
    ]),
    h('td', ref.owner),
    h('td', formatDate(ref.save_date))
  ])
}
