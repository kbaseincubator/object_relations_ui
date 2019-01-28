const { h } = require('hyperapp')

module.exports = { view, create }

// Checkbox component

function view ({ path, defaults, state, actions }) {
  const thisState = findOrSet({ path, defaults, state, actions })
  // Need a random ID for the input and label connection
  return h('span', {class: 'checkbox inline-block'}, [
    h('input', {
      type: 'checkbox',
      id: thisState.id,
      name: state.name,
      onchange: ev => {
        actions.updatePath(path.concat([ !thisState.checked ]))
        update({ checked: !thisState.checked })
        if (options.onchange) options.onchange(ev, !state.checked)
      },
      checked: state.checked
    }),
    h('label', { for: id, class: 'inline-block' }, state.text)
  ])
}

function create (options = {}) {
  return Object.assign({
    text: '',
    name: '',
    checked: false
  }, options)
}
