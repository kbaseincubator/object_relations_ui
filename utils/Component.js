// Use all useful snabbdom modules
const patch = require('snabbdom').init([
  require('snabbdom/modules/props').default,
  require('snabbdom/modules/style').default,
  require('snabbdom/modules/class').default,
  require('snabbdom/modules/eventlisteners').default,
  require('snabbdom/modules/dataset').default,
  require('snabbdom/modules/attributes').default
])

module.exports = Component

// Create simple UI components. Docs are in ../components.md
function Component (options) {
  const component = { _viewArgs: [] }
  for (let key in options) {
    if (key === 'view') continue
    if (typeof options[key] === 'function') {
      // Turn the function into a method that re-renders the view
      component[key] = function (val) {
        options[key].apply(null, [component].concat(Array.from(arguments)))
        component._render(component, options.view)
        return component
      }
    } else {
      component[key] = options[key]
    }
  }
  component.view = function () {
    component._viewArgs = Array.from(arguments)
    return component._render(component, options.view)
  }
  component._vnode = patch(document.createElement('div'), options.view(component))
  component._render = function () {
    const viewResult = options.view.apply(null, [component].concat(Array.from(component._viewArgs)))
    const newVnode = patch(component._vnode, viewResult)
    // Do some efficient subtree patching
    for (let prop in newVnode) {
      component._vnode[prop] = newVnode[prop]
    }
    return component._vnode
  }
  return component
}
