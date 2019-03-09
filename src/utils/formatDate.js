module.exports = formatDate

// Convert a string representing a date into a standard-formatted string of MM/DD/YYYY
// Fall back to the original string if anything fails

function formatDate (str) {
  try {
    const date = new Date(Date.parse(str))
    const formatted = date.toLocaleDateString('en-US')
    if (formatted === 'Invalid Date') return str
    return formatted
  } catch (e) {
    return str
  }
}
