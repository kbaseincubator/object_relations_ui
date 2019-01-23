
module.exports = findOrCreate

// Either fetch or initialize some object in the app state by a key
function findOrCreate (id, data, state, actions) {
  if (id in state) return id
  actions.update({ [id]: data })
  return id
}
