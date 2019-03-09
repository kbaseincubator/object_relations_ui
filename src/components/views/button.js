import h from 'snabbdom/h';

export function Button (txt) {
  return h('button.bg-white.ba.pv1.ph3.pointer.dim', {}, [ txt ]);
}
