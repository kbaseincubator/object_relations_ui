const { h } = require('hyperapp')
const showIf = require('./showIf')
const findOrCreate = require('./findOrCreate')

module.exports = select

// Select component that allows the user to select from among a set of options. The dropdown is closed when an option is selected.

function select ({ id, text, options, onselect }, state, actions) {
  findOrCreate(id, { open: false }, state, actions)
  if (!(id in state)) return
  const open = state[id].open
  const selected = state[id].selected
  return h('div', {class: 'inline-block  p1'}, [
    h('span', {
      style: {
        cursor: 'pointer',
        userSelect: 'none'
      },
      onclick: () => {
        actions.update({ [id]: { open: !open } })
      }
    }, [
      selected || text,
      h('span', { style: { color: 'gray' } }, open ? '▲' : '▼')
    ]),
    showIf(open, () =>
      h('ul', { class: 'm0 p0 select py1 px0 m0 mt2 border-top' }, options.map(opt => {
        return h('li', {
          class: 'm0 p0 select-option',
          style: {
            listStyleType: 'none',
            cursor: 'pointer',
            userSelect: 'none'
          },
          onclick: () => {
            actions.update({ [id]: { open: false, selected: opt } })
            onselect(opt)
          }
        }, opt)
      }))
    )
  ])
}
