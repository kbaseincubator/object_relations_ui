const { h } = require('hyperapp')
const findOrCreate = require('./findOrCreate')
const checkbox = require('./checkbox')
const dropdown = require('./dropdown')

// A dropdown whose content is a collection of checkboxes

module.exports = { create, view }

function create (defaults) {
}

function view ({ state, update }, { linkName, onchange }) {
  console.assert(state.options && state.options.length, 'must have options')
  console.assert(linkName && linkName.length, 'must provide linkName in options')
  return dropdown({
    text: state.text,
    content: state.options.map(opt => {
      const path = [listName, id, 'checkboxes']
      const checkboxScope = scope({
        state, actions,
        defaults: { text: opt, name: opt, path: []}
      })
      return h('div', {class: 'pt1'}, [
        checkbox(checkboxScope, {
          onchange: ev => {
            if (options.onchange) options.onchange(state)
          }
        })
          id: 'checkbox-dropdown-' + id,
          text: opt,
          name: opt,
          checked: !thisState.unchecked[opt],
          onchange: ev => {
            thisState.unchecked[opt] = !thisState.unchecked[opt]
            actions.update({ [id]: thisState })
            onchange(thisState)
          }
        }, state, actions)
      ])
    })
  }, state, actions)
}
