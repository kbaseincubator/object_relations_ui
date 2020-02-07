// npm
const h = require('snabbdom/h').default

// utils
const showIf = require('./utils/showIf')

// components
const Component = require('./components/Component')
const { HomologTable } = require('./components/HomologTable')

function Page () {
  return Component({
    pendingInput: true,
    loading: false,
    obj: {}, // workspace object
    homologTable: HomologTable(),
    setUpa (upa) {
      this.pendingInput = false
      this.homologTable.fetch(upa)
      this._render()
    },
    view
  })
}

function view () {
  const page = this
  const div = content => h('div.container.px2.max-width-3', content)
  if (page.pendingInput) {
    // We are still awaiting any post message for initial parameters..
    return div([
      h('p.muted', 'Waiting for input...')
    ])
  }
  return div([
    showIf(page.error, () => h('p.error', page.error)),
    h('div', [
      page.homologTable.view()
    ])
  ])
}

// This UI is used in an iframe, so we receive post messages from a parent window
window.addEventListener('message', receiveMessage, false)
// Default app config -- overridden by postMessage handlers further below
window._env = {
  kbaseEndpoint: 'https://ci.kbase.us/services',
  kbaseRoot: 'https://ci.kbase.us',
  sketchURL: 'https://ci.kbase.us/dynserv/2ef8cc90ad4caf1caa86be919d326e7b3ec90435.sketch-service',
  relEngURL: 'https://ci.kbase.us/services/relation_engine_api',
  authToken: null
}

// Initialize the Page component
document._page = Page()

// Receive JSON data in a post message
function receiveMessage (ev) {
  let data
  if (!data) {
    return
  }
  console.log('Received message:', data)
  try {
    data = JSON.parse(ev.data)
  } catch (e) {
    console.error('Unable to parse data: ' + String(data))
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
    console.log('Setting config:', config)
    window._env = Object.assign(window._env, config)
    if (config.upa) {
      document._page.setUpa(config.upa)
    }
  }
}

// -- Render the page component
document.body.appendChild(document._page._render().elm)
