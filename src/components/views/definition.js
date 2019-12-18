const h = require('snabbdom/h').default

// Term/label and definition (such as "Object" and "PF_NaOCL_trimm_paired")
module.exports = function (term, def, href) {
  let content
  if (href) {
    content = h('a.inline-block.w-text,.text-ellipsis.mw-32', { props: { href, target: '_blank' } }, def)
  } else {
    content = h('span.inline-block.ml3.text-ellipsis.mw-32rem', def)
  }
  return h('div.px1', [
    h('p.m0.py1.border-bottom.light-border', [
      h('span.bold.w-12rem.mr3.inline-block', term),
      content
    ])
  ])
}
