module.exports = formatDate

function formatDate (str) {
  const date = new Date(str)
  return date.toLocaleDateString('en-US')
}
