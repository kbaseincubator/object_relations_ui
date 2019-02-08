module.exports = formatDate

function formatDate (str) {
  const date = new Date(str)
  return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear()
}
