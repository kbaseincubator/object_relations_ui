// npm
const h = require('snabbdom/h').default

// utils
const icons = require('./utils/icons')
const showIf = require('./utils/showIf')
const { fetchTypeCounts } = require('./utils/apiClients')
const toObjKey = require('./utils/toObjKey')
const typeName = require('./utils/typeName')
const sortBy = require('./utils/sortBy')

// components
const Component = require('./components/Component')
const UpaForm = require('./components/UpaForm')
const { HomologTable } = require('./components/HomologTable')
const { LinkedDataTable } = require('./components/LinkedDataTable')

function Page () {
  return Component({
    pendingInput: true,
    loading: false,
    obj: {}, // workspace object
    upaForm: UpaForm(),
    homologTable: HomologTable(),
    fetchUpa (upa) {
      this.obj.upa = upa
      this.loading = true
      this.pendingInput = false
      this._render()
      const key = toObjKey(upa)
      this.homologTable.fetch(upa)
      fetchTypeCounts(key, null)
        .then(resp => {
          if (resp.results && resp.results.length) {
            this.typeCounts = mergeTypeCounts(resp.results[0].inb || {}, resp.results[0].out || {})
            this.typeCounts = this.typeCounts
              // Initialize a LinkedDataTable for each type result
              .map(entry => {
                entry.linkedDataTable = LinkedDataTable(key, entry.type, entry.count)
                return entry
              })
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
      // const { type } = entry
      if (!entry.linkedDataTable.data || !entry.linkedDataTable.data.length) {
        entry.linkedDataTable.fetchInitial()
      }
      this._render()
    },
    view
  })
}

function view () {
  const page = this
  window._page = page
  const div = content => h('div.container.px2.max-width-3', content)
  if (page.pendingInput) {
    // We are still awaiting any post message for initial parameters..
    return div([
      page.upaForm.view(),
      h('p.muted', 'Waiting for input...')
    ])
  }
  return div([
    page.upaForm.view(),
    showIf(page.error, () => h('p.error', page.error)),
    h('div', [
      typeHeaders(page),
      page.homologTable.view()
    ])
  ])
}

function typeHeaders (page) {
  if (page.loading) {
    return h('p.muted', 'Searching for linked data...')
  }
  if (!page.typeCounts || !page.typeCounts.length) {
    return h('p.muted', 'No linked data results.')
  }
  return h('div', [
    h('h2.mt0', 'Linked Data'),
    h('div', page.typeCounts.map(entry => {
      const { count, expanded } = entry
      const iconColor = icons.colors[entry.typeName]
      // Get the first two letters of the type for the icon
      const iconInitial = entry.typeName
        .split('').filter(c => c === c.toUpperCase()).slice(0, 3).join('')
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
            style: { paddingLeft: '38px' }
          }, [
            entry.typeName, ' · ', h('span.muted', [ count, ' total' ])
          ])
        ]),
        showIf(entry.expanded, () => typeDataSection(page, entry))
      ])
    }))
  ])
}

function typeDataSection (page, entry) {
  const iconColor = icons.colors[entry.typeName]
  return h('div.mb2.pt1.clearfix', {
    style: { paddingLeft: '38px' }
  }, [
    h('span.circle-line', {
      style: { background: iconColor }
    }),
    entry.linkedDataTable.view()
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

function mergeTypeCounts (inb, out) {
  // Convert inbound and outbound counts into a single merged object of simple type names
  const all = inb.concat(out)
    // Set some useful defaults
    .map(t => {
      return {
        type: t.type,
        count: t.type_count,
        typeVersion: t.type.match(/(\d+\.\d+)$/)[0],
        typeName: typeName(t.type)
      }
    })

  // Merge all types by type name
  const allObj = {}
  all.forEach(t => {
    const existing = allObj[t.typeName]
    if (existing) {
      const prevVersion = Number(existing.typeVersion)
      const thisVersion = Number(t.typeVersion)
      if (prevVersion === thisVersion) {
        // For multiple type counts of the same version, add them up
        allObj[t.typeName].count += t.count
      } else if (Number(existing.typeVersion) < Number(t.typeVersion)) {
        // Favor and overwritethe higher-versioned types
        allObj[t.typeName] = t
      }
    } else {
      allObj[t.typeName] = t
    }
  })
  // Convert back to an array, sorted by type name
  return Object.values(allObj).sort((x, y) => sortBy(x.typeName, y.typeName))
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
