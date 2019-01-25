const { h } = require('hyperapp')

module.exports = { view, create }

// Checkbox component

function view ({ state, update }, options = {}) {
  // Need a random ID for the input and label connection
  const id = String(Math.random() * 1000000)
  return h('span', {class: 'checkbox inline-block'}, [
    h('input', {
      type: 'checkbox',
      id,
      name: state.name,
      onchange: ev => {
        update({ checked: !state.checked })
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
