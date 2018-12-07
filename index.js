const { h, app } = require('hyperapp')

const state = {}

const actions = {
  update: () => state => state
}

const data = {
  linked: [
    {
      obj_name: 'Pseudomonas_assembly',
      obj_type: 'Assembly',
      obj_href: '#',
      narr_name: 'Genome narrative',
      narr_href: '#',
      owner: 'jplfaria1',
      owner_href: '#',
      subObjects: [
        {
          obj_name: 'reads_import',
          obj_type: 'PairedEndLibrary',
          obj_href: '#',
          narr_name: 'Genome narrative',
          owner: 'jplfaria1',
          owner_href: '#',
          narr_href: '#'
        }
      ]
    }
  ],
  copies: [
    {
      obj_name: 'shew_copy1',
      obj_type: 'Genome',
      obj_href: '#',
      narr_name: 'RNA-Seq narrative',
      narr_href: '#',
      owner: 'jplfaria1',
      owner_href: '#',
      subObjects: [
        {
          obj_name: 'shew_RNASeqData',
          obj_type: 'RNASeqSampleSet',
          obj_href: '#',
          narr_name: 'RNA-Seq narrative',
          narr_href: '#',
          owner: 'jplfaria1',
          owner_href: '#'
        }
      ]
    },
    {
      obj_name: 'shew_copy2',
      obj_type: 'Genome',
      obj_href: '#',
      narr_name: 'Model',
      narr_href: '#',
      owner: 'fliu',
      owner_href: '#',
      subObjects: [
        {
          obj_name: 'shew_model',
          obj_type: 'Model',
          obj_href: '#',
          narr_name: 'Model',
          narr_href: '#',
          owner: 'fliu',
          owner_href: '#'
        }
      ]
    },
    {
      obj_name: 'shew_copy3',
      obj_type: 'Genome',
      obj_href: '#',
      narr_name: 'Pangenome narrative',
      narr_href: '#',
      owner: 'jplfaria1',
      subObjects: [
        {
          obj_name: 'shew_pangenome',
          obj_type: 'Pangenome',
          obj_href: '#',
          narr_name: 'Pangenome narrative',
          narr_href: '#',
          owner: 'jplfaria1',
          owner_href: '#'
        },
        {
          obj_name: 'shew_genomeset',
          obj_type: 'GenomeSet',
          obj_href: '#',
          narr_name: 'Pangenome narrative',
          narr_href: '#',
          owner: 'jplfaria1',
          owner_href: '#'
        }
      ]
    }
  ],
  similar: [
    {
      obj_name: 'shew.RX45',
      obj_type: 'Genome',
      obj_href: '#',
      obj_distance: '0.091',
      owner: 'KBaseRefData',
      owner_href: '#',
      subObjects: [
        {
          obj_name: 'shew.RX45',
          obj_type: 'Assembly',
          obj_href: '#',
          owner: 'KBaseRefData',
          owner_href:  '#'
        }
      ]
    },
    {
      obj_name: 'shew.ON89lazy',
      obj_type: 'Assembly',
      obj_distance: '0.089',
      narr_name: 'Lazy strain',
      narr_href: '#',
      owner: 'jplfaria',
      owner_href: '#',
      subObjects: [
        {
          obj_name: 'shew.ON89',
          obj_type: 'Genome',
          narr_name: 'Lazy strain',
          narr_href: '#',
          owner: 'jplfaria',
          owner_href: '#'
        },
        {
          obj_name: 'lazy_RNASeqData',
          obj_type: 'RNASeqSampleSet',
          obj_href: '#',
          narr_name: 'Lazy strain',
          narr_href: '#',
          owner: 'jplfaria',
          owner_href: '#'
        }
      ]
    },
    {
      obj_name: 'shew.far.way',
      obj_type: 'Genome',
      obj_href: '#',
      narr_name: 'Shewanella',
      narr_href: '#',
      owner: 'j_collaborator',
      owner_href: '#',
      obj_distance: '0.085',
      subObjects: []
    }
  ]
}

/**
 * little svg line that represents sub-object links
 */
function graphLine () {
  const style = 'stroke: #bbb; stroke-width: 2'
  const height = 22
  return h('svg', {
    height: height + 1,
    width: 25,
    class: 'inline-block align-middle mr1',
    style: 'position: relative; top: -10px'
  }, [
    h('line', {x1: 5, y1: 0, x2: 5, y2: height, style}),
    h('line', {x1: 4, y1: height, x2: 25, y2: height, style})
  ])
}

function subDataSection (entry, subentry) {
  let name = subentry.obj_name
  if (subentry.obj_type) {
    name += ' (' + subentry.obj_type + ')'
  }
  let narrative = ''
  if (subentry.narr_name && subentry.narr_name !== entry.narr_name) {
    narrative = h('span', {}, [
      ' in ',
      h('a', {href: subentry.narr_href}, subentry.narr_name)
    ])
  }
  let author = ''
  if (subentry.owner && subentry.owner !== entry.owner) {
    author = h('span', {}, [
      ' by ',
      h('a', {href: subentry.owner_href}, subentry.owner)
    ])
  }
  return h('div', {class: 'pl1'}, [
    graphLine(),
    h('span', {class: 'inline-block muted'}, [
      h('a', {href: subentry.obj_href}, name),
      narrative,
      author
    ])
  ])
}

function dataSection (entry) {
  return h('div', {class: 'py1'}, [
    h('div', {class: 'h3 mb1'}, [
      h('span', {class: 'mr1 circle'}, ''),
      h('a', {href: entry.obj_href}, entry.obj_name),
      ' in ',
      h('a', {href: entry.narr_href}, entry.narr_name),
      ' by ',
      h('a', {href: entry.owner_href}, entry.owner)
    ]),
    // Sub-sections
    entry.subObjects.map(subentry => subDataSection(entry, subentry))
  ])
}

function filterTools () {
  return h('div', { class: 'pb1' }, [
    'Filter by ',
    h('button', {class: 'btn mx2'}, 'Type'),
    h('button', {class: 'btn mr2'}, 'Owner'),
    h('div', {class: 'chkbx ml2'}, [
      h('div', {class: 'checkmark'}),
      h('input', {type: 'checkbox', id: 'chkbox1'}),
      h('label', {for: 'chkbox1'}, 'Public')
    ]),
    h('div', {class: 'chkbx ml2'}, [
      h('div', {class: 'checkmark'}),
      h('input', {type: 'checkbox', id: 'chkbox2'}),
      h('label', {for: 'chkbox2'}, 'Private')
    ])
  ])
}

function header (text) {
  return h('div', {class: 'my2 py1 border-bottom'}, [
    h('h2', {class: 'inline-block m0 h3'}, text),
    h('span', {class: 'right inline-block'}, '10 total')
  ])
}

function view (state, actions) {
  /*
  return h('div', {class: 'pa4'}, [
    h('h2', {class: 'normal'}, [
      'Knowledge Graph for ', h('a', {}, 'rhodo_spades_prokka'),
      ' (Genome)'
    ]),
    h('ul', {class: 'tree'}, [
      viewAction(data)
    ])
  ])
  */
  console.log('hello... world?')
  return h('div', {class: 'container px2 py3 max-width-3'}, [
    header('Linked data'),
    h('div', {},
      data.linked.map(dataSection)
    ),
    header('Copies'),
    h('div', {}, [ filterTools() ]),
    h('div', {}, data.copies.map(dataSection)),
    header('Similar data'),
    h('div', {}, [ filterTools() ]),
    h('div', {}, data.similar.map(dataSection))
  ])
}

const container = document.querySelector('#hyperapp-container')
app(state, actions, view, container)
