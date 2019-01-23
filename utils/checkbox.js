const { h } = require('hyperapp')
const findOrCreate = require('./findOrCreate')

module.exports = checkbox

// Simple styled checkbox component
function checkbox ({ id, text, name, checked, onchange }, state, actions) {
  findOrCreate(id, { checked }, state, actions)
  if (!(id in state)) return
  const thisState = state[id]
  return h('span', {class: 'checkbox inline-block'}, [
    h('input', {
      type: 'checkbox',
      id,
      name,
      onchange: ev => {
        const newState = Object.assign(thisState, { checked: !thisState.checked })
        actions.update({ [id]: newState })
        if (onchange) onchange(ev, newState)
      },
      checked: thisState.checked
    }),
    h('label', { for: id, class: 'inline-block' }, text)
  ])
}
