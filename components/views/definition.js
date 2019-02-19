const h = require('snabbdom/h').default

// Term/label and definition (such as "Object" and "PF_NaOCL_trimm_paired")
module.exports = function (term, def, href) {
  let content
  if (href) {
    content = h('a.inline-block.right.text-ellipsis.mw-36rem', { props: { href, target: '_blank' } }, def)
  } else {
    content = h('span.inline-block.right.text-ellipsis.mw-36rem', def)
  }
  return h('div.px1', [
    h('p.m0.py1.border-bottom.light-border', [
      h('span.bold.color-devil', term),
      content
    ])
  ])
}
