const { h, app } = require('hyperapp')
const serialize = require('form-serialize')

let state = {}
// Load cached form data
try {
  state = JSON.parse(window.localStorage.getItem('state'))
  state.loading = false
} catch (e) {
  window.localStorage.removeItem('state')
  state = {}
}

const actions = {
  update: state => () => {
    console.log('new state', state)
    return state
  }
}

/*
// Placeholder data.
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
          owner_href: '#'
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
*/

function submitForm (ev, actions) {
  ev.preventDefault()
  actions.update({ loading: true })
  const data = serialize(ev.currentTarget, { hash: true })
  actions.update(data)
  fetchObj(data.upa, data.token, (err, results) => {
    if (err) {
      actions.update({ obj: null, loading: false, error: String(err) })
      return
    }
    if (results[0]) {
      actions.update({ obj: results[0], error: null })
    }
  })
  // fetchProvenance(data.upa, data.token, actions)
  // fetchHomologs(data.upa, data.token, actions)
}

// Convert something like "Module.Type-5.0" into just "Type"
// Returns the input if we cannot match the format
function typeName (typeStr) {
  const matches = typeStr.match(/^.+\.(.+)-.+$/)
  if (matches.length === 2) {
    return matches[1]
  }
  return typeStr
}

function objInfo (obj) {
  if (!obj) return ''
  return h('div', {class: 'my2 py1 border-bottom'}, [
    h('h2', {}, [state.obj.obj_name, ' (', typeName(state.obj.ws_type), ')']),
    h('p', {}, [
      'In narrative ',
      h('a', {
        href: `https://narrative.kbase.us/narrative/ws.${state.obj.workspace_id}.obj.1`,
        target: '_blank'
      }, [
        state.obj.narr_name
      ]),
      ' by ',
      h('a', {
        href: 'https://narrative.kbase.us/#people/' + state.obj.owner,
        target: '_blank'
      }, [ state.obj.owner ])
    ])
  ])
}

// Top-level view function
function view (state, actions) {
  window.localStorage.setItem('state', JSON.stringify(state))
  let provenance = ''
  let similar = ''
  let errorMsg = ''
  if (state.provenance) {
  }
  if (state.similar) {
  }
  if (state.error) {
    errorMsg = h('p', {}, state.error)
  }
  return h('div', {class: 'container px2 py3 max-width-3'}, [
    h('h2', {}, 'Relation Engine Object Viewer'),
    h('form', { onsubmit: ev => submitForm(ev, actions) }, [
      h('fieldset', {class: 'col col-4'}, [
        h('label', {class: 'block mb2 bold'}, 'KBase auth token (CI)'),
        h('input', {
          class: 'input p1', required: true, type: 'password', name: 'token', value: state.token
        })
      ]),
      h('fieldset', {class: 'col col-4'}, [
        h('label', {class: 'block mb2 bold'}, 'Object Address (Prod)'),
        h('input', {
          placeholder: '30462/10/1',
          class: 'input p1',
          required: true,
          type: 'text',
          name: 'upa',
          value: state.upa
        })
      ]),
      h('fieldset', {class: 'col-8 pt2'}, [
        h('button', {disabled: state.loading, class: 'btn', type: 'submit'}, state.loading ? 'Loading' : 'Submit')
      ])
    ]),
    errorMsg,
    objInfo(state.obj),
    /*
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
    */
    provenance,
    similar
  ])
}

/*
// Little svg line that represents sub-object links
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
*/

/*
// Section of parent data, with circle icon
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
*/

/*
// Section of sub-objects with little graph lines
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
*/

/*
// Filter results
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
*/

/*
// Section header
function header (text) {
  return h('div', {class: 'my2 py1 border-bottom'}, [
    h('h2', {class: 'inline-block m0 h3'}, text),
    h('span', {class: 'right inline-block'}, '10 total')
  ])
}
*/

// Render to the page
const container = document.querySelector('#hyperapp-container')
app(state, actions, view, container)

/*
// Fetch provenance results for an object
function fetchProvenance (upa, token, actions) {
  // Fetch the data
  const query = (`
    // let obj_id = FIRST(
    //   for e in wsprov_copied_into
    //     sort rand()
    //     limit 1
    //     return e._from
    // )
    let obj_id = CONCAT("wsprov_object/", @obj_key)
    let links = (
      for obj in 1..1 any obj_id wsprov_links
      filter obj
      return obj
    )
    let copies = (
      for obj in 1..100 any obj_id wsprov_copied_into
      filter obj
      return obj
    )
    let copy_links = (
      for obj in wsprov_object
      filter obj in copies
      for obj1 in 1..100 any obj wsprov_links
      filter obj1
      return {copy_id: obj._id, copy: obj1}
    )
    let link_links = (
      for obj in wsprov_object
      filter obj in links
      for obj1 in 1..100 any obj wsprov_links
      filter obj1
      return {link_id: obj._id, link: obj1}
    )
    return {copies: copies, copy_links: copy_links, obj_id: obj_id, links: links, link_links}
  `)
  const payload = { query, obj_key: upa.replace(/\//g, ':') }
  aqlQuery(payload, token, results => {
    actions.update({ provenance: results })
  })
}
*/

function fetchObj (upa, token, cb) {
  // Fetch info about an object
  const query = (`
    let obj_id = CONCAT("wsprov_object/", @obj_key)
    for obj in wsprov_object
      filter obj._id == obj_id
      return obj
  `)
  const payload = { query, obj_key: upa.replace(/\//g, ':') }
  aqlQuery(payload, token, cb)
}

/*
function fetchLinks (upa, token, cb) {
  // Fetch all linked and sub-linked data from an upa
}
*/

/*
function fetchCopies (upa, token, cb) {
  // Fetch all copies and linked data of those copies from an upa
}
*/

/*
function fetchHomologs (upa, token, cb) {
  // Use the sketch service to fetch homologs
  // (only applicable to reads, assemblies, or annotations)
  // For each homolog with a kbase_id, fetch the sub-links
  const url = 'https://kbase.us/dynserv/78a20dfaa6b39390ec2da8c02ccf8f1a7fc6198a.sketch-service'
  const payload = {
    method: 'get_homologs',
    params: [upa]
  }
  window.fetch(url, {
    method: 'POST',
    headers: { },
    mode: 'cors',
    body: JSON.stringify(payload)
  })
    .then(resp => resp.json())
    .then(function (json) {
      console.log(json.result)
      let kbaseResults = json.result.distances.filter(result => {
        return 'kbase_id' in result
      }).map(r => r.kbase_id.replace(/\//g, ':'))
      console.log(kbaseResults)
      // For all linked objects for each results with a kbase_id
    })
    .catch(function (err) {
      console.log({ err })
      console.log(String(err))
    })
}
*/

function aqlQuery (payload, token, cb) {
  // Fetch the data
  window.fetch('https://ci.kbase.us/services/relation_engine_api/api/query_results', {
    method: 'POST',
    headers: {
      // 'Content-Type': 'application/json',
      'Authorization': token
    },
    mode: 'cors',
    body: JSON.stringify(payload)
  })
    .then(resp => resp.json())
    .then(json => {
      console.log(json)
      if (json.error) throw new Error(json.error)
      if (!json.results.length) throw new Error('No results found')
      cb(null, json.results)
    })
    .catch(err => cb(err))
}
