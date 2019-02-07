// Use all useful snabbdom modules
const patch = require('snabbdom').init([
  require('snabbdom/modules/props').default,
  require('snabbdom/modules/style').default,
  require('snabbdom/modules/class').default,
  require('snabbdom/modules/eventlisteners').default,
  require('snabbdom/modules/dataset').default,
  require('snabbdom/modules/attributes').default
])
const h = require('snabbdom/h').default

module.exports = Component

// Create simple UI components. Docs are in ../components.md
function Component (obj) {
  const view = obj.view
  obj._viewArgs = []
  obj._vnode = patch(document.createElement('div'), h('div'))
  obj._render = function () {
    const newVnode = patch(obj._vnode, view.apply(obj, obj._viewArgs))
    // Do some efficient subtree patching
    for (let prop in newVnode) {
      obj._vnode[prop] = newVnode[prop]
    }
    return obj._vnode
  }
  obj.view = function () {
    obj._viewArgs = arguments
    return obj._render()
  }
  return obj
}
