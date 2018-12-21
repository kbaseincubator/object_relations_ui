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

// Fetch a random object to search on
function fetchRando (state, actions) {
  actions.update({ loading: true })
  fetchRandomObj(state.token)
    .then(result => {
      const upa = result.replace('wsprov_object/', '').replace(/:/g, '/')
      actions.update({ upa })
    })
    .then(() => actions.update({ loading: false, error: null }))
    .catch(err => {
      actions.update({ obj: null, loading: false, error: String(err), upa: null })
    })
}

// Perform a full fetch on an object
function submitForm (ev, actions) {
  ev.preventDefault()
  actions.update({
    obj: null,
    similarLinked: null,
    similar: null,
    copies: null,
    links: null,
    error: null,
    loading: true
  })
  const data = serialize(ev.currentTarget, { hash: true })
  actions.update(data)
  fetchObj(data.upa, data.token)
    .then(results => {
      console.log('obj info results', results)
      actions.update({ obj: results })
      return fetchLinkedObjs(data.upa, data.token)
    })
    .then(results => {
      console.log('linked results', results)
      actions.update({ links: results })
      return fetchCopies(data.upa, data.token)
    })
    .then(results => {
      console.log('copy results', results)
      actions.update({ copies: results })
      return fetchHomologs(data.upa, data.token)
    })
    .then(results => {
      if (!results || !results.length) return
      console.log('homology results', results)
      actions.update({ similar: results })
      const kbaseResults = results.filter(r => 'kbase_id' in r)
        .map(r => r.kbase_id.replace(/\//g, ':'))
      console.log('kbase results', kbaseResults)
      // TODO Find all linked objects for each results with a kbase_id
      return fetchManyLinkedObjs(kbaseResults, data.token)
    })
    .then(results => {
      console.log('homology link results', results)
      actions.update({ similarLinked: results })
    })
    // Stop loading
    .then(() => actions.update({ loading: false }))
    .catch(err => actions.update({ error: String(err) }))
  // fetchProvenance(data.upa, data.token, actions)
  // fetchHomologs(data.upa, data.token, actions)
}

// Convert something like "Module.Type-5.0" into just "Type"
// Returns the input if we cannot match the format
function typeName (typeStr) {
  const matches = typeStr.match(/^.+\.(.+)-.+$/)
  if (!matches) return typeStr
  return matches[1]
}

function objHrefs (obj) {
  return {
    narrative: `https://narrative.kbase.us/narrative/ws.${obj.workspace_id}.obj.1`,
    obj: 'https://narrative.kbase.us/#dataview/' + obj._key.replace(/:/g, '/'),
    owner: 'https://narrative.kbase.us/#people/' + obj.owner
  }
}

function objInfo (obj) {
  if (!obj) return ''
  return h('div', {class: 'mt2 pt1'}, [
    h('h2', {}, [
      h('a', {
        href: objHrefs(obj).obj,
        target: '_blank',
        class: 'bold'
      }, [
        obj.obj_name, ' (', typeName(obj.ws_type), ')'
      ])
    ]),
    h('p', {}, [
      'In narrative ',
      h('a', {
        href: `https://narrative.kbase.us/narrative/ws.${obj.workspace_id}.obj.1`,
        target: '_blank'
      }, [
        obj.narr_name
      ]),
      ' by ',
      h('a', {
        href: 'https://narrative.kbase.us/#people/' + obj.owner,
        target: '_blank'
      }, [ obj.owner ])
    ])
  ])
}

// Top-level view function
function view (state, actions) {
  window.localStorage.setItem('state', JSON.stringify(state))
  const errorMsg = state.error ? h('p', {}, state.error) : ''
  return h('div', {class: 'container px2 py3 max-width-3'}, [
    h('h1', {class: 'mt0 mb3'}, 'Relation Engine Object Viewer'),
    h('form', { onsubmit: ev => submitForm(ev, actions) }, [
      h('fieldset', {class: 'col col-4'}, [
        h('label', {class: 'block mb2 bold'}, 'KBase auth token (CI)'),
        h('input', {
          class: 'input p1', required: true, type: 'password', name: 'token', value: state.token
        })
      ]),
      h('fieldset', {class: 'col col-6'}, [
        h('label', {class: 'block mb2 bold'}, 'Object Address (Prod)'),
        h('input', {
          placeholder: '30462/10/1',
          class: 'input p1',
          required: true,
          type: 'text',
          name: 'upa',
          value: state.upa
        }),
        h('a', { class: 'btn right h5', onclick: () => fetchRando(state, actions) }, 'Fetch random object ID')
      ]),
      h('fieldset', {class: 'clearfix col-12 pt2'}, [
        h('button', {disabled: state.loading, class: 'btn', type: 'submit'}, state.loading ? 'Loading' : 'Submit')
      ])
    ]),
    errorMsg,
    h('p', {}, 'Note that the filters do not work yet. Homology search takes ~30 seconds on the first run.'),
    objInfo(state.obj),
    linkedObjsSection(state),
    copyObjsSection(state),
    similarObjsSection(state)
  ])
}

function linkedObjsSection (state) {
  if (!state.links || !state.links.links.length) return ''
  const links = state.links.links
  const sublinks = state.links.sublinks
  return h('div', {class: 'clearfix'}, [
    header('Linked data', links.length),
    filterTools(),
    h('div', {}, links.map(l => dataSection(sublinks, l)))
  ])
}

function copyObjsSection (state) {
  if (!state.copies || !state.copies.copies.length) return ''
  const copies = state.copies.copies
  const sublinks = state.copies.sublinks
  return h('div', {class: 'clearfix mt2'}, [
    header('Copies', copies.length),
    filterTools(),
    h('div', {}, copies.map(c => dataSection(sublinks, c)))
  ])
}

function similarObjsSection (state) {
  if (!state.similar || !state.similar.length) return ''
  return h('div', { class: 'clearfix mt2' }, [
    header('Similar data', state.similar.length),
    h('div', {}, state.similar.map(similarObjSection))
  ])
}

function similarObjSection (entry) {
  // TODO href is ncbi or kbase based on kbase_id
  let href = '#'
  if (entry.kbase_id) {
    href = 'https://narrative.kbase.us/#dataview/' + entry.kbase_id
  } else {
    href = 'https://www.ncbi.nlm.nih.gov/assembly/' + entry.sourceid
  }
  return h('div', {class: 'clearfix py1'}, [
    h('div', {class: 'h3 mb1'}, [
      h('p', {class: 'semi-muted mb1 my0 h4'}, [h('span', {class: 'bold'}, entry.dist), ' distance']),
      h('span', {class: 'mr1 circle left'}, ''),
      h('div', {class: 'clearfix left'}, [
        h('a', { href, target: '_blank' }, entry.sciname)
      ])
    ])
  ])
}

// Section of parent data, with circle icon
function dataSection (sublinks, entry) {
  const hrefs = objHrefs(entry)
  sublinks = sublinks.filter(l => l.parent_id === entry._id)
  console.log('sublinks', sublinks)
  return h('div', {class: 'clearfix py1'}, [
    h('div', {class: 'h3 mb1 clearfix'}, [
      h('span', {class: 'mr1 circle left'}, ''),
      h('div', {class: 'clearfix left'}, [
        h('a', { href: hrefs.obj, target: '_blank' }, entry.obj_name),
        ' (', typeName(entry.ws_type), ') '
      ]),
      h('div', {class: 'clearfix left h4 mt1'}, [
        ' In ',
        h('a', { href: hrefs.narrative, target: '_blank' }, entry.narr_name),
        ' by ',
        h('a', { href: hrefs.owner, target: '_blank' }, entry.owner)
      ])
    ]),
    // Sub-link sections
    h('div', { class: 'clearfix' }, [
      sublinks.map(subentry => subDataSection(subentry.obj, entry))
    ])
  ])
}

// Section of sublinked objects with little graph lines
function subDataSection (subentry, entry) {
  const hrefs = objHrefs(subentry)
  let name = subentry.obj_name
  if (subentry.ws_type) {
    name += ' (' + typeName(subentry.ws_type) + ')'
  }
  let narrative = ''
  if (subentry.narr_name && subentry.narr_name !== entry.narr_name) {
    narrative = h('span', {}, [
      'In ',
      h('a', {href: hrefs.narrative, target: '_blank'}, subentry.narr_name)
    ])
  }
  let author = ''
  if (subentry.owner && subentry.owner !== entry.owner) {
    author = h('span', {}, [
      ' by ',
      h('a', {href: hrefs.owner, target: '_blank'}, subentry.owner)
    ])
  }
  return h('div', {class: 'pl1 clearfix mb1'}, [
    graphLine(),
    h('span', {class: 'inline-block muted'}, [
      h('div', {}, [ h('a', {href: hrefs.obj, target: '_blank'}, name) ]),
      h('div', {}, [ narrative, author ])
    ])
  ])
}

// Little svg line that represents sub-object links
function graphLine () {
  const style = 'stroke: #bbb; stroke-width: 2'
  const height = 22
  return h('svg', {
    height: height + 1,
    width: 25,
    class: 'inline-block align-top mr1',
    style: 'position: relative; top: -10px'
  }, [
    h('line', {x1: 5, y1: 0, x2: 5, y2: height, style}),
    h('line', {x1: 4, y1: height, x2: 25, y2: height, style})
  ])
}

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

// Section header
function header (text, total) {
  return h('div', {class: 'my2 py1 border-bottom'}, [
    h('h2', {class: 'inline-block m0 h3'}, text),
    h('span', {class: 'right inline-block'}, [total, ' total'])
  ])
}

// Render to the page
const container = document.querySelector('#hyperapp-container')
app(state, actions, view, container)

function fetchObj (upa, token) {
  // Fetch info about an object
  const query = (`
    let obj_id = CONCAT("wsprov_object/", @obj_key)
    for obj in wsprov_object
      filter obj._id == obj_id
      return obj
  `)
  const payload = { query, obj_key: upa.replace(/\//g, ':') }
  return aqlQuery(payload, token)
}

function fetchLinkedObjs (upa, token) {
  // Fetch all linked and sub-linked data from an upa
  const query = (`
    let obj_id = CONCAT("wsprov_object/", @obj_key)
    let links = (
      for obj in 1..1 any obj_id wsprov_links
      filter obj
      return obj
    )
    let sublinks = (
      for obj in wsprov_object
      filter obj in links
      for obj1 in 1..100 any obj wsprov_links
        filter obj1
        limit 10
        return distinct {parent_id: obj._id, obj: obj1}
    )
    return {links: links, sublinks: sublinks}
  `)
  const payload = { query, obj_key: upa.replace(/\//g, ':') }
  return aqlQuery(payload, token)
}

function fetchManyLinkedObjs (upas, token) {
  const objIds = upas.map(u => 'wsprov_object/' + u.replace(/\//g, ':'))
  console.log('???')
  console.log(objIds)
  const query = (`
    let links = (
      for obj in wsprov_object
      filter obj._id in @objIds
      for obj1 in 1..100 any obj wsprov_links
        filter obj1
        return {obj: obj1, parent_id: obj._id}
    )
    return {links: links}
  `)
  console.log(query)
  const payload = { query, objIds }
  return aqlQuery(payload, token)
}

function fetchCopies (upa, token, cb) {
  // Fetch all copies and linked data of those copies from an upa
  const query = (`
    let obj_id = CONCAT("wsprov_object/", @obj_key)
    let copies = (
      for obj in 1..100 any obj_id wsprov_copied_into
      filter obj
      return obj
    )
    let sublinks = (
      for obj in wsprov_object
      filter obj in copies
      for obj1 in 1..100 any obj wsprov_links
        filter obj1
        limit 10
        return distinct {parent_id: obj._id, obj: obj1}
    )
    return {copies: copies, sublinks: sublinks}
  `)
  const payload = { query, obj_key: upa.replace(/\//g, ':') }
  return aqlQuery(payload, token)
}

function fetchHomologs (upa, token) {
  // Use the sketch service to fetch homologs
  // (only applicable to reads, assemblies, or annotations)
  // For each homolog with a kbase_id, fetch the sub-links
  const url = 'https://kbase.us/dynserv/78a20dfaa6b39390ec2da8c02ccf8f1a7fc6198a.sketch-service'
  const payload = {
    method: 'get_homologs',
    params: [upa]
  }
  return window.fetch(url, {
    method: 'POST',
    headers: { },
    mode: 'cors',
    body: JSON.stringify(payload)
  })
    .then(resp => resp.json())
    .then(function (json) {
      console.log('homology json', json)
      if (json && json.result && json.result.distances && json.result.distances.length) {
        return json.result.distances
      }
    })
}

function fetchRandomObj (token) {
  const query = (`
    for e in wsprov_copied_into
      sort rand()
      limit 1
      return e._from
  `)
  const payload = { query }
  return aqlQuery(payload, token)
}

function aqlQuery (payload, token, cb) {
  // Fetch the data
  return window.fetch('https://ci.kbase.us/services/relation_engine_api/api/query_results', {
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
      if (json && json.results && json.results.length) return json.results[0]
      if (json && json.error) throw new Error(json.error)
    })
}
