module.exports = sortBy

function sortBy (x, y) {
  if (x > y) return 1
  if (x < y) return -1
  return 0
}
