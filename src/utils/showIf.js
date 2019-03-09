module.exports = showIf

// A bit more readable ternary conditional for use in views
// Display the vnode if the boolean is truthy
// Can pass a plain vnode or a function that returns a vnode
function showIf (bool, vnode) {
  if (bool) {
    return typeof vnode === 'function' ? vnode() : vnode
  }
  return ''
}
