// npm
const h = require('snabbdom/h').default

// utils
const showIf = require('./utils/showIf')
const { fetchLinkedObjs } = require('./utils/apiClients')
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
      this.loading += 1
      this._render()
      const key = toObjKey(upa)
      fetchLinkedObjs(key)
        .then(resp => {
          if (resp.results) {
            this.linked = resp.results
            this.linkedCount = resp.count
            this.linkedCursor = resp.has_more ? resp.cursor_id : null
          } else if (resp.error) {
            this.error = resp.error
          }
          this.loading -= 1
          this._render()
        })
      /*
      fetchLinkedObjs([upa], null)
        .then(results => {
          if (results && results.links) {
            this.linked = results.links
          } else {
            this.linked = null
          }
          this.loading -= 1
          this._render()
        })
      fetchCopies(upa, null)
        .then(results => {
          if (results && results.copies) {
            this.copies = results.copies
          } else {
            this.copies = null
          }
          this.loading -= 1
          this._render()
        })
      */
    },
    view
  })
}

function view () {
  const page = this
  const div = content => h('div.container.p2.max-width-3', content)
  return div([
    page.upaForm.view(),
    showIf(page.loading, () => h('p', 'Loading...')),
    showIf(page.error, () => h('p.error', page.error)),
    showIf(page.linked, () => dataTable(page, 'Related Data', page.linked)),
    noResults(page, 'No linked data found', page.linked)
  ])
}

function dataTable (page, title, data) {
  return h('div', {
    class: {
      'muted': page.loading
    }
  }, [
    sectionHeader(title, page.linkedCount + ' total'),
    h('table.table-lined', [
      h('thead', [
        h('tr', [
          h('th', 'Name'),
          h('th', 'Type'),
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
          h('td', typeName(vertex.ws_type)),
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

function noResults (page, msg, results) {
  if (page.loading) return ''
  if (results) return ''
  return h('div.mt2', {
    style: {
      borderTop: '1px solid #ddd'
    }
  }, [
    h('p.muted', msg)
  ])
}

function sectionHeader (text, rightText) {
  return h('div.my2.py1', [
    h('h2.inline-block.m0.h3', text),
    h('span.mx1.inline-block', ' · '),
    h('span.inline-block.muted', rightText)
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

// This UI is used in an iframe, so we receive post messages from a parent window
window.addEventListener('message', receiveMessage, false)
window._env = {
  kbaseEndpoint: 'https://kbase.us/services',
  kbaseRoot: 'https://narrative.kbase.us',
  sketchURL: 'https://kbase.us/dynserv/78a20dfaa6b39390ec2da8c02ccf8f1a7fc6198a.sketch-service',
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
      document._page.fetchUpa(config.upa)
    }
  }
}

// TODO use this: const noTrailingSlash = str => str.replace(/\/$/, '')

// -- Render the page component
document.body.appendChild(document._page._render().elm)
