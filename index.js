const Component = require('./utils/Component')
const h = require('snabbdom/h').default
const showIf = require('./utils/showIf')
const { fetchLinkedObjs, fetchCopies } = require('./utils/apiClients')

function Page () {
  return Component({
    obj: {},
    fetchUpa: (C, upa) => {
      C.obj.upa = upa
      C.loading = true
      fetchLinkedObjs([upa], null)
        .then(results => {
          if (results && results.links) {
            C.linked = results.links
          } else {
            C.linked = null
          }
          C.loading = false
          C._render()
        })
      fetchCopies(upa, null)
        .then(results => {
          if (results && results.copies) {
            C.copies = results.copies
          } else {
            C.copies = null
          }
          C.loading = false
          C._render()
        })
    },
    view
  })
}

function view (cmp) {
  console.log('viewing', cmp)
  return h('div.container.p2.max-width-3', [
    showIf(cmp.loading, () => h('p', 'Loading...')),
    showIf(cmp.error, () => h('p.error', cmp.error)),
    showIf(cmp.linked, () => h('div', cmp.linked.map(x => JSON.stringify(x)))),
    showIf(cmp.copies, () => h('div', cmp.copies.map(x => JSON.stringify(x))))
  ])
}

document._page = Page()
document.body.appendChild(document._page._vnode.elm)

// This UI is used in an iframe, so we receive post messages from a parent window
window.addEventListener('message', receiveMessage, false)
window._env = {
  kbaseEndpoint: 'https://kbase.us/services',
  kbaseRoot: 'https://kbase.us',
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
