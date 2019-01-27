const Component = require('./utils/Component')
const h = require('snabbdom/h').default
const showIf = require('./utils/showIf')
const { fetchLinkedObjs, fetchCopies } = require('./utils/apiClients')

function Page () {
  return Component({
    obj: {}, // workspace object
    fetchUpa (upa) {
      this.obj.upa = upa
      this.loading = true
      this._render()
      fetchLinkedObjs([upa], null)
        .then(results => {
          if (results && results.links) {
            this.linked = results.links
          } else {
            this.linked = null
          }
          this.loading = false
          this._render()
        })
      fetchCopies(upa, null)
        .then(results => {
          if (results && results.copies) {
            this.copies = results.copies
          } else {
            this.copies = null
          }
          this.loading = false
          this._render()
        })
    },
    view
  })
}

function view () {
  const cmp = this
  return h('div.container.p2.max-width-3', [
    h('p', 'hello world'),
    showIf(cmp.loading, () => h('p', 'Loading...')),
    showIf(cmp.error, () => h('p.error', cmp.error)),
    showIf(cmp.linked, () => dataTable(cmp, 'Linked Data', cmp.linked)),
    showIf(cmp.copies, () => dataTable(cmp, 'Copies', cmp.copies))
  ])
}

function dataTable (cmp, title, data) {
  return h('div', [
    sectionHeader(title, data.length + ' total'),
    h('table.table-lined', [
      h('thead', [
        h('tr', [
          h('th', 'Name'),
          h('th', 'Type'),
          h('th', 'Creator'),
          h('th', 'Narrative')
        ])
      ]),
      h('tbody', cmp.linked.map(linked => {
        const hrefs = objHrefs(linked)
        return h('tr', [
          h('td', [
            h('a', { props: { href: hrefs.obj } }, linked.obj_name)
          ]),
          h('td', typeName(linked.ws_type)),
          h('td', [
            h('a', { props: { href: hrefs.owner } }, linked.owner)
          ]),
          h('td', [
            h('a', { props: { href: hrefs.narrative } }, linked.narr_name)
          ])
        ])
      }))
    ])
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
    hrefs.obj = dataview + obj._key.replace(/:/g, '/')
  }
  if (obj.workspace_id) {
    hrefs.narrative = `https://narrative.kbase.us/narrative/ws.${obj.workspace_id}.obj.1`
  }
  if (obj.owner) {
    hrefs.owner = url + '/#people/' + obj.owner
  }
  return hrefs
}

document._page = Page()
document.body.appendChild(document._page._render().elm)

// This UI is used in an iframe, so we receive post messages from a parent window
window.addEventListener('message', receiveMessage, false)
window._env = {
  kbaseEndpoint: 'https://kbase.us/services',
  kbaseRoot: 'https://narrative.kbase.us',
  sketchURL: 'https://kbase.us/dynserv/78a20dfaa6b39390ec2da8c02ccf8f1a7fc6198a.sketch-service',
  relEngURL: 'https://kbase.us/services/relation_engine_api',
  authToken: null
}

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

window._messageHandlers = {
  setUPA: function (params) {
    document._page.fetchUpa({ upa: params.upa })
  },
  setKBaseEndpoint: function (params) {
    window._env.kbaseEndpoint = noTrailingSlash(params.url)
  },
  setRelEngURL: function (params) {
    window._env.relEngURL = noTrailingSlash(params.url)
  },
  setSketchURL: function (params) {
    window._env.sketchURL = noTrailingSlash(params.url)
  },
  setAuthToken: function (params) {
    window._env.authToken = params.token
  }
}
const noTrailingSlash = str => str.replace(/\/$/, '')
