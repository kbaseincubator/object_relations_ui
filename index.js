// npm
const h = require('snabbdom/h').default

// utils
const icons = require('./utils/icons')
const showIf = require('./utils/showIf')
const { fetchHomologs, fetchTypeCounts, fetchLinkedObjs } = require('./utils/apiClients')
const toObjKey = require('./utils/toObjKey')
const toUpa = require('./utils/toUpa')

// components
const Component = require('./components/Component')
const UpaForm = require('./components/UpaForm')

function Page () {
  return Component({
    loading: 0,
    obj: {}, // workspace object
    upaForm: UpaForm(),
    fetchUpa (upa) {
      this.obj.upa = upa
      this.loading = true
      this._render()
      const key = toObjKey(upa)
      console.log('upa', upa)
      this.loadingHomologs = true
      fetchHomologs(upa)
        .then(resp => {
          this.loadingHomologs = false
          if (resp && resp.length) {
            this.homologs = resp
          } else {
            this.homologs = null
          }
          this._render()
        })
      fetchTypeCounts(key, null)
        .then(resp => {
          if (resp.results && resp.results.length) {
            this.typeCounts = resp.results
          } else {
            this.typeCounts = null
          }
          this.loading = false
          this._render()
        })
        .catch(err => {
          console.error(err)
          this.loading = false
          this._render()
        })
    },
    fetchTypeList (entry) {
      const { type } = entry
      entry.loading = true
      this._render()
      fetchLinkedObjs(toObjKey(this.obj.upa), type)
        .then(resp => {
          entry.subdata = null
          if (resp.results) {
            entry.subdata = resp.results
          } else if (resp.error) {
            console.error(resp.error)
          } else {
          }
          entry.loading = false
          console.log('resp', resp)
          this._render()
        })
        .catch(err => {
          console.error(err)
          entry.loading = false
          this._render()
        })
    },
    view
  })
}

function view () {
  const page = this
  window._page = page
  const div = content => h('div.container.p2.max-width-3', content)
  return div([
    page.upaForm.view(),
    showIf(page.loading, () => h('p.muted', 'Loading...')),
    showIf(page.error, () => h('p.error', page.error)),
    showIf(page.typeCounts, () => typeHeaders(page)),
    showIf(!page.loading && page.loadingHomologs, () => h('p.muted', 'Loading similar data...')),
    showIf(page.homologs, () => homologTable(page)),
    showIf(!page.loading && !page.loadingHomologs && !page.typeCounts && !page.homologs, () =>
      h('p.muted', 'No results found')
    )
  ])
}

function typeHeaders (page) {
  return h('div', {
    class: { faded: page.loading }
  }, [
    h('h2', 'Linked Data'),
    h('div', page.typeCounts.map(entry => {
      const { type_count: count, expanded } = entry
      const type = typeName(entry.type)
      const iconColor = icons.colors[type]
      const iconInitial = type.split('').filter(c => c === c.toUpperCase()).slice(0, 2).join('')
      return h('div.relative.result-row.my2', [
        h('div.hover-parent', {
          on: {
            click: () => {
              entry.expanded = !entry.expanded
              if (entry.expanded && !entry.subdata) {
                page.fetchTypeList(entry)
              } else {
                page._render()
              }
            }
          }
        }, [
          circleIcon(iconInitial, expanded, iconColor),
          h('h4.inline-block.m0', {
            style: {
              paddingLeft: '32px'
            }
          }, [
            type, ' · ', h('span.muted', [ count, ' total' ])
          ])
        ]),
        showIf(entry.expanded, () => typeDataSection(page, entry))
      ])
    }))
  ])
}

function typeDataSection (page, entry) {
  const type = typeName(entry.type)
  const iconColor = icons.colors[type]
  console.log('entry.type, type, iconColor', entry.type, type, iconColor)
  return h('div.mb2.pt1', {
    style: {
      paddingLeft: '32px'
    }
  }, [
    h('span.circle-line', {
      style: { background: iconColor }
    }),
    showIf(entry.loading, () => h('p.muted.my2', 'Loading...')),
    showIf(entry.subdata, () => dataTable(page, 'Objects', entry.subdata))
  ])
}

function circleIcon (contents, isExpanded, background) {
  return h('span.mr1.circle.inline-block', {
    class: {
      'hover-caret-up': isExpanded,
      'hover-caret-down': !isExpanded
    },
    style: { background }
  }, [
    h('span.hover-hide', [contents]),
    h('span.hover-arrow.hover-inline-block', isExpanded ? '−' : '+')
  ])
}

function homologTable (page) {
  return h('div', {
    class: { faded: page.loading }
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
      h('tbody', page.homologs.map(hom => {
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
    ])
  ])
}

function dataTable (page, title, data) {
  console.log('data', data)
  return h('div', {
    class: {
      faded: page.loading
    }
  }, [
    h('table.table-lined', [
      h('thead', [
        h('tr', [
          h('th', 'Name'),
          h('th', 'Date'),
          h('th', 'Creator'),
          h('th', 'Narrative')
        ])
      ]),
      h('tbody', data.map(({ path, vertex }) => {
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
    ])
  ])
}

// Convert something like "Module.Type-5.0" into just "Type"
// Returns the input if we cannot match the format
function typeName (typeStr) {
  const matches = typeStr.match(/^.+\.(.+)-.+$/)
  if (!matches) return typeStr
  return matches[1]
}

// Generate KBase url links for an object
function objHrefs (obj) {
  const url = window._env.kbaseRoot
  const dataview = url + '/#dataview/'
  const typeUrl = url + '/#spec/type/'
  const hrefs = {}
  if (obj.ws_type) {
    hrefs.type = typeUrl + obj.ws_type
  }
  if (obj.upa) {
    hrefs.obj = dataview + obj.upa
  } else if (obj._key) {
    hrefs.obj = dataview + toUpa(obj._key)
  }
  if (obj.workspace_id) {
    hrefs.narrative = `https://narrative.kbase.us/narrative/ws.${obj.workspace_id}.obj.1`
  }
  if (obj.owner) {
    hrefs.owner = url + '/#people/' + obj.owner
  }
  return hrefs
}

function formatDate (str) {
  const date = new Date(str)
  return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear()
}

// This UI is used in an iframe, so we receive post messages from a parent window
window.addEventListener('message', receiveMessage, false)
// Default app config -- overridden by postMessage handlers further below
window._env = {
  kbaseEndpoint: 'https://kbase.us/services',
  kbaseRoot: 'https://narrative.kbase.us',
  sketchURL: 'https://kbase.us/dynserv/1b054633a008e078cec1a20dfd6d118d53c31ed4.sketch-service',
  relEngURL: 'https://kbase.us/services/relation_engine_api',
  authToken: null
}

// Initialize the Page component
document._page = Page()

// Receive JSON data in a post message
function receiveMessage (ev) {
  let data
  try {
    data = JSON.parse(ev.data)
  } catch (e) {
    console.error(e)
    return
  }
  if (!(data.method in window._messageHandlers)) {
    console.error('Unknown method: ' + data.method)
    console.log('Docs: ' + 'https://github.com/kbaseincubator/object_relations_ui')
    return
  }
  window._messageHandlers[data.method](data.params)
}

// Handle post message methods
window._messageHandlers = {
  setConfig: function ({ config }) {
    window._env = Object.assign(window._env, config)
    if (config.upa) {
      document._page.fetchUpa(config.upa.replace(/:/g, '/'))
    }
  }
}

// -- Render the page component
document.body.appendChild(document._page._render().elm)
