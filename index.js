const { h, app } = require('hyperapp')

// Create a new state for the app from scratch with any defaults
function createState () {
  return { navHistory: [] }
}
let state
// Load cached form data from localStorage
try {
  state = JSON.parse(window.localStorage.getItem('state'))
  state.loading = false
} catch (e) {
  window.localStorage.removeItem('state')
  state = createState()
}

// We just use actions.update for everything to keep it simple
const actions = {
  update: state => () => state
}

// Click an object in the link/copy/search results
// This does a new search on that object and adds the previous object to the breadcrumb stack
function clickObject (state, actions, name, upa) {
  // TODO do a window history push state
  state.navHistory = state.navHistory || []
  state.navHistory.push({ name: state.obj.obj_name, upa: state.upa })
  actions.update({ navHistory: state.navHistory, obj: { obj_name: name } })
  newSearch(state, actions, upa)
}

// Perform a full fetch on an object
// This performs serveral fetches on a couple services
function newSearch (state, actions, upa) {
  // Reset all the state, clear out results
  state.upa = upa
  actions.update({
    upa,
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
        if (!state.obj || !state.obj_name) {
          actions.update({ obj: { obj_name: 'Object ' + state.upa, upa: state.upa } })
        }
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
  const hrefs = {}
  if (obj.upa) {
    hrefs.obj = dataview + obj.upa
  } else if (obj._key) {
    hrefs.obj = dataview + obj._key.replace(/:/g, '/')
  }
  if (obj.workspace_id) {
    hrefs.narrative = `https://narrative.kbase.us/narrative/ws.${obj.workspace_id}.obj.1`
  }
  if (obj.owner) {
    hrefs.owner = 'https://narrative.kbase.us/#people/' + obj.owner
  }
  return hrefs
}

// Top-level view function
function view (state, actions) {
  window.localStorage.setItem('state', JSON.stringify(state))
  return h('div', {class: 'container px2 py3 max-width-3'}, [
    h('h1', {class: 'mt0 mb3'}, 'Relation Engine Object Viewer'),
    h('form', {
      onsubmit: ev => {
        ev.preventDefault()
        actions.update({ navHistory: [] })
        newSearch(state, actions, state.upa)
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
          h('a', { class: 'btn ml2 h5', onclick: () => fetchRandom(state, actions) }, 'Get random ID')
        ),
        showIf(state.loadingUpa, h('p', { class: 'inline-block ml2 m0' }, 'Loading...'))
      ]),
      h('fieldset', {class: 'clearfix col-12 pt2'}, [
        h('button', {disabled: !state.authToken, class: 'btn', type: 'submit'}, 'Submit'),
        showIf(!state.authToken, h('p', { class: 'pl2 inline-block' }, 'Please enter an auth token first.'))
      ])
    ]),
    showIf(state.error, h('p', { class: 'error' }, state.error)),
    objInfo(state, actions),
    linkedObjsSection(state, actions),
    copyObjsSection(state, actions),
    similarData(state, actions)
  ])
}

// Breadcrumb navigation view
function backButton (state, actions) {
  if (!state.navHistory || !state.navHistory.length) return ''
  return h('button', {
    class: 'btn inline-block mr2',
    style: {
      // Fix the vertical alignment with text next to it
      position: 'relative',
      top: '-2px'
    },
    onclick: () => {
      const last = state.navHistory.pop()
      state.upa = last.upa
      actions.update({ navHistory: state.navHistory, upa: state.upa, obj: { obj_name: last.name, upa: last.upa } })
      newSearch(state, actions, last.upa)
    }
  }, '⬅ Back')
}

// Generic object info view
function objInfo (state, actions) {
  const obj = state.obj
  if (!obj) return ''
  const hrefs = objHrefs(obj)
  const title = h('h2', {class: 'my0 inline-block'}, [
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
  return h('div', {class: 'mt3'}, [
    h('div', {}, [
      backButton(state, actions),
      title
    ]),
    body
  ])
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
  if (state.loading) {
    return h('p', {
      class: 'muted bold'
    }, 'Loading related data...')
  }
  if (!state.links || !state.links.links.length) return ''
  const links = state.links.links
  const sublinks = state.links.sublinks
  return h('div', {class: 'clearfix'}, [
    header('Linked data', links.length),
    // filterTools(),
    h('div', {}, links.map(l => dataSection(sublinks, l, state, actions)))
  ])
}

// Copied objects section
function copyObjsSection (state, actions) {
  if (state.loading) return ''
  if (!state.copies || !state.copies.copies.length) return ''
  const copies = state.copies.copies
  const sublinks = state.copies.sublinks
  return h('div', {class: 'clearfix mt2'}, [
    header('Copies', copies.length),
    // filterTools(),
    h('div', {}, copies.map(c => dataSection(sublinks, c, state, actions)))
  ])
}

// Similar data section (search results from the assembly homology service)
function similarData (state, actions) {
  if (state.searching) {
    return h('p', {
      class: 'muted bold'
    }, 'Searching for homologous genomes (can take up to 30 seconds)...')
  }
  if (!state.similar || !state.similar.length) return ''
  return h('div', { class: 'clearfix mt2' }, [
    header('Similar data', state.similar.length),
    h('div', {}, state.similar.map(s => similarObjSection(s, state, actions)))
  ])
}

// Section for a single similar objects, with all sub-linked objects
function similarObjSection (entry, state, actions) {
  let distance
  if (entry.dist === 0) {
    distance = [h('span', {class: 'bold'}, 'exact match')]
  } else {
    distance = [h('span', {class: 'bold'}, entry.dist), ' distance']
  }
  const readableNS = entry.namespaceid.replace('_', ' ')
  const entryName = entry.sciname || entry.sourceid
  return h('div', {class: 'clearfix py1'}, [
    h('div', {class: 'h3-5 mb1'}, [
      h('p', {class: 'semi-muted mb0-5 my0 h4'}, distance),
      h('span', {class: 'mr1 circle left'}, ''),
      h('div', {class: 'clearfix left'}, [
        h('a', {
          onclick: () => {
            const upa = entry.kbase_id
            clickObject(state, actions, entryName, upa)
          }
        }, entryName),
        h('span', { class: 'muted' }, [' (', readableNS, ')'])
      ])
    ])
  ])
}

// Section of parent data, with circle icon
function dataSection (sublinks, entry, state, actions) {
  const hrefs = objHrefs(entry)
  sublinks = sublinks.filter(l => l.parent_id === entry._id)
  const entryName = entry.obj_name
  return h('div', {class: 'clearfix py1'}, [
    h('div', {class: 'h3-5 mb1 clearfix', style: {'whiteSpace': 'nowrap'}}, [
      h('span', {class: 'mr1 circle inline-block'}, ''),
      h('div', {class: 'inline-block text-ellipsis'}, [
        h('a', {
          class: 'bold',
          onclick: ev => {
            const upa = entry._key.replace(/:/g, '/')
            clickObject(state, actions, entryName, upa)
          }
        }, entryName),
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
    style: { paddingLeft: '32px' }
  }, [
    h('div', {
      style: { position: 'absolute', top: '-32px', left: '7.5px' }
    }, [ graphLine() ]),
    h('span', {class: 'inline-block muted'}, [
      h('div', {}, [
        h('a', {
          onclick: () => {
            const upa = subentry._key.replace(/:/g, '/')
            clickObject(state, actions, name, upa)
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
  const height = 43
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

// Section header
function header (text, total) {
  return h('div', {class: 'my2 py1 border-bottom'}, [
    h('h2', {class: 'inline-block m0 h3'}, text),
    h('span', {class: 'right inline-block'}, [total, ' total'])
  ])
}

// Render to the page
const container = document.querySelector('#hyperapp-container')
const acts = app(state, actions, view, container)

// Set the actions and state globally for easy debugging
window.acts = acts

// Utility for setting the token from the JS console
window.setAuthToken = function (token) {
  acts.update({ authToken: token })
}

window.setUpa = function (upa) {
  acts.update({ upa })
  newSearch(state, acts, upa)
}

window.fetchRandom = function () {
  if (!state.authToken) console.error('You must set the auth token first (use window.setAuthToken)')
  actions.fetchRandom()
}

function fetchObj (upa, token) {
  // Fetch info about an object
  const query = (`
    for obj in wsprov_object
      filter obj._key == @obj_key
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

// Get 1st-level linked objects for every given object in a list
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

// Fetch all copies and linked objects of those copies from an upa
function fetchCopies (upa, token, cb) {
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

// Use the sketch service to fetch homologs (only applicable to reads, assemblies, or annotations)
// For each homolog with a kbase_id, fetch the sub-links
function fetchHomologs (upa, token) {
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

// Fetch a random object to search on
// We find an object that has at least 1 copy, so the data is somewhat interesting
function fetchRandom (state, actions) {
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

// Make a request to the relation engine api to do an ad-hoc admin query for prototyping
function aqlQuery (payload, token, cb) {
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
