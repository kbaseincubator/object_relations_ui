const { h } = require('hyperapp')
const showIf = require('./showIf')
const findOrCreate = require('./findOrCreate')

// Dropdown component that can have arbitrary dropdown content (unlike a select, which has a list of options)

module.exports = dropdown

document.addEventListener('click', ev => {
  const drop = document.body._dropdownOpen
  if (!drop) return
  // Don't run this on the first open
  if (drop && drop.ignore) {
    drop.ignore = false
    return
  }
  let target = ev.target
  // Check if we are clicking within the dropdown content
  while (target.parentNode) {
    if (target.hasAttribute('dropdowncontent')) return
    target = target.parentNode
  }
  closeDropdown(drop.id, drop.actions)
})

// Globally close an open dropdown
function closeDropdown (id, actions) {
  console.log('closing', id)
  actions.update({ [id]: { open: false } })
  document.body._dropdownOpen = null
}

function dropdown ({ id, text, content }, state, actions) {
  findOrCreate(id, { open: false }, state, actions)
  if (!(id in state)) return
  const open = state[id].open
  return h('div', { class: 'relative inline-block' }, [
    h('span', {
      class: 'inline-block btn',
      style: { cursor: 'pointer', userSelect: 'none' },
      onclick: () => {
        actions.update({ [id]: { open: !open } })
        if (!open) {
          // If a different dropdown is open elsewhere, close it first
          // We'll have to modify this if we want multiple dropdowns open
          if (document.body._dropdownOpen) {
            closeDropdown(document.body._dropdownOpen.id, actions)
          }
          document.body._dropdownOpen = { actions, id, ignore: true }
        }
      }
    }, [
      text,
      h('span', { style: { color: 'gray' } }, open ? '▲' : '▼')
    ]),
    showIf(open, () => h('div', {
      dropdowncontent: true,
      class: 'p1 border-top dropdown-content'
    }, content))
  ])
}
