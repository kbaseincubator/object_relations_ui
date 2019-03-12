const h = require('snabbdom/h').default

function table (headers, data) {
  return h('table', [
    h('thead', headers.map(txt =>
      h('th.tl.sticky.mr3', txt)
    ))
  ])
}

module.exports = table
