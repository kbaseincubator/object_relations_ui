module.exports = formatDateTime

function formatDateTime (str) {
  const date = new Date(str)
  return date.toLocaleString('en-US')
}
