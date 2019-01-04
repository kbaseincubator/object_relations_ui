const { h, app } = require('hyperapp')

let state = {}
// Load cached form data from localStorage
try {
  state = JSON.parse(window.localStorage.getItem('state'))
  state.loading = false
} catch (e) {
  window.localStorage.removeItem('state')
  state = {}
}

const actions = {
  update: state => () => state
}

// Fetch a random object to search on
// We find an object that has at least 1 copy, so the data is somewhat interesting
function fetchRando (state, actions) {
  actions.update({ loadingUpa: true })
  function makeRequest (token) {
    const query = (`
      for e in wsprov_copied_into
        sort rand()
        limit 1
        return e._from
    `)
    const payload = { query }
    return aqlQuery(payload, token)
  }
  makeRequest(state.authToken)
    .then(result => {
      const upa = result.replace('wsprov_object/', '').replace(/:/g, '/')
      actions.update({ upa })
    })
    .then(() => actions.update({ loadingUpa: false, error: null }))
    .catch(err => {
      actions.update({ obj: null, loadingUpa: false, error: String(err), upa: null })
    })
}

// Perform a full fetch on an object
// This performs serveral fetches on a couple services
function newSearch (state, actions) {
  // Reset all the state, clear out results
  actions.update({
    obj: null,
    similarLinked: null,
    similar: null,
    copies: null,
    links: null,
    error: null,
    loading: true,
    searching: true
  })
  fetchObj(state.upa, state.authToken)
    .then(results => {
      console.log('obj info results', results)
      if (results) {
        actions.update({ obj: results })
      } else {
        actions.update({ obj: { obj_name: 'Object ' + state.upa, upa: state.upa } })
      }
      return fetchLinkedObjs(state.upa, state.authToken)
    })
    .then(results => {
      console.log('linked results', results)
      actions.update({ links: results })
      return fetchCopies(state.upa, state.authToken)
    })
    .then(results => {
      console.log('copy results', results)
      actions.update({ copies: results, loading: false })
      return fetchHomologs(state.upa, state.authToken)
    })
    .then(results => {
      if (!results || !results.length) return
      console.log('homology results', results)
      actions.update({ similar: results })
      const kbaseResults = results.filter(r => 'kbase_id' in r)
        .map(r => r.kbase_id.replace(/\//g, ':'))
      console.log('kbase results', kbaseResults)
      // TODO Find all linked objects for each results with a kbase_id
      return fetchManyLinkedObjs(kbaseResults, state.authToken)
    })
    .then(results => {
      console.log('homology link results', results)
      actions.update({ similarLinked: results, searching: false })
    })
    // Always set an error and stop loading on an exception
    .catch(err => actions.update({ error: String(err), loading: false, searching: false }))
}

// Convert something like "Module.Type-5.0" into just "Type"
// Returns the input if we cannot match the format
function typeName (typeStr) {
  const matches = typeStr.match(/^.+\.(.+)-.+$/)
  if (!matches) return typeStr
  return matches[1]
}

// Generate KBase linksf or an object
function objHrefs (obj) {
  const dataview = 'https://narrative.kbase.us/#dataview/'
  if (obj.upa) {
    return { obj: dataview + obj.upa }
  }
  return {
    narrative: `https://narrative.kbase.us/narrative/ws.${obj.workspace_id}.obj.1`,
    obj: dataview + obj._key.replace(/:/g, '/'),
    owner: 'https://narrative.kbase.us/#people/' + obj.owner
  }
}

// Top-level view function
function view (state, actions) {
  window.localStorage.setItem('state', JSON.stringify(state))
  return h('div', {class: 'container px2 py3 max-width-3'}, [
    h('h1', {class: 'mt0 mb3'}, 'Relation Engine Object Viewer'),
    h('form', {
      onsubmit: ev => {
        ev.preventDefault()
        newSearch(state, actions)
      }
    }, [
      h('fieldset', {class: 'col col-4'}, [
        h('label', {class: 'block mb2 bold'}, 'KBase auth token (CI)'),
        h('input', {
          class: 'input p1',
          required: true,
          type: 'password',
          name: 'token',
          oninput: ev => {
            actions.update({ authToken: ev.currentTarget.value })
            return ev
          },
          value: state.authToken
        })
      ]),
      h('fieldset', {class: 'col col-6'}, [
        h('label', {class: 'block mb2 bold'}, 'Object Address (Prod)'),
        h('input', {
          placeholder: '1/2/3',
          class: 'input p1',
          required: true,
          type: 'text',
          name: 'upa',
          input: ev => actions.update({ upa: ev.currentTarget.value }),
          value: state.upa
        }),
        showIf(
          state.authToken && !state.loadingUpa,
          h('a', { class: 'btn right h5', onclick: () => fetchRando(state, actions) }, 'Fetch random object ID')
        ),
        showIf(state.loadingUpa, h('p', { class: 'inline-block pl2 m0' }, 'Loading...'))
      ]),
      h('fieldset', {class: 'clearfix col-12 pt2'}, [
        h('button', {disabled: !state.authToken, class: 'btn', type: 'submit'}, 'Submit'),
        showIf(!state.authToken, h('p', { class: 'pl2 inline-block' }, 'Please enter an auth token first.'))
      ])
    ]),
    showIf(state.error, h('p', { class: 'error' }, state.error)),
    objInfo(state),
    linkedObjsSection(state, actions),
    copyObjsSection(state, actions),
    similarData(state, actions)
  ])
}

// Generic object info view
function objInfo (state) {
  const obj = state.obj
  if (!obj) return ''
  const hrefs = objHrefs(obj)
  const title = h('h2', {}, [
    h('a', { href: hrefs.obj, target: '_blank', class: 'bold' }, [
      obj.obj_name,
      showIf(state.obj.ws_type, () => ' (' + typeName(state.obj.ws_type) + ')')
    ])
  ])
  const body = h('p', {}, [
    showIf(
      obj.narr_name,
      () => h('span', {}, [
        'In narrative ',
        h('a', { href: hrefs.narrative, target: '_blank' }, [ obj.narr_name ])
      ])
    ),
    showIf(
      obj.owner,
      () => h('span', {}, [
        ' by ',
        h('a', { href: hrefs.owner, target: '_blank' }, [ obj.owner ])
      ])
    )
  ])
  return h('div', {class: 'mt2 pt1'}, [ title, body ])
}

// A bit more readable ternary conditional for use in views
// Display the vnode if the boolean is truthy
function showIf (bool, vnode) {
  if (bool) {
    if (typeof vnode === 'function') return vnode()
    else return vnode
  }
  return ''
}

// Section of linked objects -- "Linked data"
function linkedObjsSection (state, actions) {
  if (state.loading) return h('p', {}, 'Loading related data...')
  if (!state.links || !state.links.links.length) return h('p', {class: 'muted'}, 'No linked data.')
  const links = state.links.links
  const sublinks = state.links.sublinks
  return h('div', {class: 'clearfix'}, [
    header('Linked data', links.length),
    filterTools(),
    h('div', {}, links.map(l => dataSection(sublinks, l, state, actions)))
  ])
}

function copyObjsSection (state, actions) {
  if (state.loading) return ''
  if (!state.copies || !state.copies.copies.length) return h('p', {class: 'muted'}, 'No copies.')
  const copies = state.copies.copies
  const sublinks = state.copies.sublinks
  return h('div', {class: 'clearfix mt2'}, [
    header('Copies', copies.length),
    filterTools(),
    h('div', {}, copies.map(c => dataSection(sublinks, c, state, actions)))
  ])
}

function similarData (state, actions) {
  if (state.searching) return h('p', {}, 'Searching for homologs...')
  if (!state.similar || !state.similar.length) return h('p', {class: 'muted'}, 'No similarity results.')
  return h('div', { class: 'clearfix mt2' }, [
    header('Similar data', state.similar.length),
    h('div', {}, state.similar.map(s => similarObjSection(s, state, actions)))
  ])
}

function similarObjSection (entry, state, actions) {
  const readableNS = entry.namespaceid.replace('_', ' ')
  return h('div', {class: 'clearfix py1'}, [
    h('div', {class: 'h3 mb1'}, [
      h('p', {class: 'semi-muted mb1 my0 h4'}, [h('span', {class: 'bold'}, entry.dist), ' distance']),
      h('span', {class: 'mr1 circle left'}, ''),
      h('div', {class: 'clearfix left'}, [
        h('a', {
          onclick: () => {
            const upa = entry.kbase_id
            actions.update({ upa })
            state.upa = upa
            newSearch(state, actions)
          }
        }, entry.sciname || entry.sourceid),
        h('span', { class: 'muted' }, [' (', readableNS, ')'])
      ])
    ])
  ])
}

// Section of parent data, with circle icon
function dataSection (sublinks, entry, state, actions) {
  const hrefs = objHrefs(entry)
  sublinks = sublinks.filter(l => l.parent_id === entry._id)
  return h('div', {class: 'clearfix py1'}, [
    h('div', {class: 'h3 mb1 clearfix', style: {'whiteSpace': 'nowrap'}}, [
      h('span', {class: 'mr1 circle inline-block'}, ''),
      h('div', {class: 'inline-block'}, [
        h('a', {
          onclick: ev => {
            const upa = entry._key.replace(/:/g, '/')
            actions.update({ upa })
            newSearch(state, actions)
          }
        }, entry.obj_name),
        ' (', typeName(entry.ws_type), ') ',
        ' in ',
        h('a', { href: hrefs.narrative, target: '_blank' }, entry.narr_name)
      ])
    ]),
    // Sub-link sections
    h('div', {}, [
      sublinks.map(subentry => subDataSection(subentry.obj, entry, state, actions))
    ])
  ])
}

// Section of sublinked objects with little graph lines
function subDataSection (subentry, entry, state, actions) {
  const hrefs = objHrefs(subentry)
  let name = subentry.obj_name
  let type = ''
  if (subentry.ws_type) {
    type = ' (' + typeName(subentry.ws_type) + ')'
  }
  let narrative = ''
  if (subentry.narr_name && subentry.narr_name !== entry.narr_name) {
    narrative = h('span', {}, [
      ' in ',
      h('a', {href: hrefs.narrative, target: '_blank'}, subentry.narr_name)
    ])
  }
  /*
  let author = ''
  if (subentry.owner && subentry.owner !== entry.owner) {
    author = h('span', {}, [
      ' by ',
      h('a', {href: hrefs.owner, target: '_blank'}, subentry.owner)
    ])
  }
  */
  return h('div', {
    class: 'relative clearfix mb1',
    style: { paddingLeft: '33px' }
  }, [
    h('div', {
      style: { position: 'absolute', top: '-32px', left: '7.5px' }
    }, [ graphLine() ]),
    h('span', {class: 'inline-block muted'}, [
      h('div', {}, [
        h('a', {
          onclick: () => {
            const upa = subentry._key.replace(/:/g, '/')
            actions.update({ upa })
            state.upa = upa
            newSearch(state, actions)
          }
        }, name),
        type,
        narrative
      ])
    ])
  ])
}

// Little svg line that represents sub-object links
function graphLine () {
  const style = 'stroke: #bbb; stroke-width: 2'
  const height = 40
  const width = 22
  return h('svg', {
    height: height + 1,
    width,
    class: 'inline-block align-top mr1'
  }, [
    h('line', {x1: 5, y1: 0, x2: 5, y2: height, style}),
    h('line', {x1: 4, y1: height, x2: width, y2: height, style})
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
      if (json && json.result && json.result.distances && json.result.distances.length) {
        return json.result.distances
      }
    })
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
