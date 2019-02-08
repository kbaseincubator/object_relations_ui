// npm
const h = require('snabbdom/h').default

// utils
const icons = require('./utils/icons')
const showIf = require('./utils/showIf')
const { fetchTypeCounts } = require('./utils/apiClients')
const toObjKey = require('./utils/toObjKey')

// components
const Component = require('./components/Component')
const UpaForm = require('./components/UpaForm')
const { HomologTable } = require('./components/HomologTable')
const { LinkedDataTable } = require('./components/LinkedDataTable')

function Page () {
  return Component({
    loading: 0,
    obj: {}, // workspace object
    upaForm: UpaForm(),
    homologTable: HomologTable(),
    fetchUpa (upa) {
      this.obj.upa = upa
      this.loading = true
      this._render()
      const key = toObjKey(upa)
      this.homologTable.fetch(upa)
      fetchTypeCounts(key, null)
        .then(resp => {
          if (resp.results && resp.results.length) {
            this.typeCounts = resp.results
              // Initialize a LinkedDataTable for each type result
              .map(entry => {
                entry.linkedDataTable = LinkedDataTable(key, entry.type, entry.type_count)
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
  const div = content => h('div.container.p2.max-width-3', content)
  return div([
    page.upaForm.view(),
    showIf(page.loading, () => h('p.muted.bold', 'Loading...')),
    showIf(page.error, () => h('p.error', page.error)),
    h('div', {class: {faded: page.loading}}, [
      typeHeaders(page),
      page.homologTable.view()
    ])
  ])
}

function typeHeaders (page) {
  if (!page.typeCounts || !page.typeCounts.length) {
    return h('p.muted', 'No linked data results')
  }
  return h('div', [
    h('h2.mt0', 'Linked Data'),
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
  return h('div.mb2.pt1.clearfix', {
    style: {
      paddingLeft: '32px'
    }
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

// Convert something like "Module.Type-5.0" into just "Type"
// Returns the input if we cannot match the format
function typeName (typeStr) {
  const matches = typeStr.match(/^.+\.(.+)-.+$/)
  if (!matches) return typeStr
  return matches[1]
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
