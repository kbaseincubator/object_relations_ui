const { h, app } = require('hyperapp')
const { fetchLinkedObjs, fetchCopies, fetchHomologs } = require('./utils/apiClients')

/* TODO
- generate type links for objects
- finish formatting the sublinks
- get the graphline working for sublinks
- show object aggregate details ("knowledge score") at top
  - total number of copies and links regardless of perms
- Click on a row expands it into details -- functionality
- Click on a row expands it into details -- data
- object type icons
- fliparino icon for expanding
*/

const state = { navHistory: [], obj: {} }

const actions = {
  // Click an object to expand its link results
  expandEntry: (entry) => (state, actions) => {
    const upa = entry._key.replace(/:/g, '/')
    entry.expanded = !entry.expanded
    if (!entry.sublinks || !entry.sublinks.length) {
      fetchLinkedObjs([upa], window._env.authToken)
        .then(results => {
          if (results && results.links) {
            entry.sublinks = results.links
          } else {
            entry.sublinks = []
          }
          actions.update({})
        })
        .catch(err => {
          console.error(err)
        })
    }
    actions.update({})
  },
  followLink: ({ name, upa }) => (state, actions) => {
    const navHistory = state.navHistory || []
    actions.setObject({ name, upa })
    navHistory.push({ name: name, upa: state.upa })
    actions.update({ navHistory })
  },
  setObject: ({ name, upa }) => (state, actions) => {
    const obj = { obj_name: name, upa }
    actions.update({ obj, upa })
    newSearch(state, actions, upa)
  },
  update: state => () => state
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
    loadingCopies: true,
    loadingLinks: true
  })
  /*
  // Fetch the object itself to get name, type, etc
  fetchObj(state.upa, window._env.authToken)
    .then(results => {
      if (results) {
        actions.update({ obj: results })
      } else {
        if (!state.obj || !state.obj_name) {
          actions.update({ obj: { obj_name: 'Object ' + state.upa, upa: state.upa } })
        }
      }
      return fetchLinkedObjs(state.upa, window._env.authToken)
    })
    */
  // Fetch all objects linked by reference or by provenance
  fetchLinkedObjs([state.upa], window._env.authToken)
    .then(results => {
      console.log('linked results', results)
      actions.update({ links: results, loadingLinks: false })
    })
    .catch(err => actions.update({ error: String(err), loadingLinks: false }))
  // Fetch all copies of this object, either upstream or downstream
  fetchCopies(state.upa)
    .then(results => {
      console.log('copy results', results)
      actions.update({ copies: results, loadingCopies: false })
    })
    .catch(err => actions.update({ error: String(err), loadingCopies: false }))
  // Do an assembly homology search on the object, then fetch all linked objects for each search result
  actions.update({ searching: true })
  fetchHomologs(state.upa)
    .then(results => {
      if (!results || !results.length) return
      console.log('homology results', results)
      actions.update({ similar: results })
      const kbaseResults = results.filter(r => 'kbase_id' in r)
        .map(r => r.kbase_id.replace(/\//g, ':'))
      console.log('kbase results', kbaseResults)
      // TODO Find all linked objects for each results with a kbase_id
      return fetchLinkedObjs(kbaseResults, window._env.authToken)
    })
    .then(results => {
      console.log('homology link results', results)
      actions.update({ similarLinked: results, searching: false })
    })
    .catch(err => actions.update({ error: String(err), searching: false }))
}

/*
// Check whether an object is an assembly, genome, or reads, meaning it is
// searchable by the AssemblyHomologyService
function searchableWithHomology (obj) {
  const validTypes = ['PairedEndLibrary', 'SingleEndLibrary', 'Genome', 'Assembly', 'ContigSet']
  return obj.ws_type && validTypes.filter(t => RegExp(t).test(obj.ws_type)).length
}
*/

// Convert something like "Module.Type-5.0" into just "Type"
// Returns the input if we cannot match the format
function typeName (typeStr) {
  const matches = typeStr.match(/^.+\.(.+)-.+$/)
  if (!matches) return typeStr
  return matches[1]
}

// Generate KBase url links for an object
function objHrefs (obj) {
  const url = window._env.kbaseEndpoint
  const dataview = url + '/#dataview/'
  const typeUrl = url + '/#spec/type/'
  const hrefs = {}
  if (obj.ws_type) {
    hrefs.type = typeUrl + obj.ws_type
  }
  if (obj.upa) {
    hrefs.obj = dataview + obj.upa
  } else if (obj._key) {
    hrefs.obj = dataview + obj._key.replace(/:/g, '/')
  }
  if (obj.workspace_id) {
    hrefs.narrative = `https://narrative.kbase.us/narrative/ws.${obj.workspace_id}.obj.1`
  }
  if (obj.owner) {
    hrefs.owner = url + '/#people/' + obj.owner
  }
  return hrefs
}

// Top-level view function
function view (state, actions) {
  if (!state.loadingCopies && !state.loadingLinks && !state.links && !state.copies) {
    return h('p', {class: 'container p2 muted'}, 'No results found.')
  }
  return h('div', {class: 'container p2 max-width-3'}, [
    // h('h1', {class: 'mt0 mb3'}, 'Relation Engine Object Viewer'),
    /*
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
          value: window._env.authToken
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
          window._env.authToken && !state.loadingUpa,
          h('a', { class: 'btn ml2 h5', onclick: () => fetchRandom(state, actions) }, 'Get random ID')
        ),
        showIf(state.loadingUpa, h('p', { class: 'inline-block ml2 m0' }, 'Loading...'))
      ]),
      h('fieldset', {class: 'clearfix col-12 pt2'}, [
        h('button', {disabled: !window._env.authToken, class: 'btn', type: 'submit'}, 'Submit'),
        showIf(!window._env.authToken, h('p', { class: 'pl2 inline-block' }, 'Please enter an auth token first.'))
      ])
    ]),
    */
    showIf(state.error, h('p', { class: 'error' }, state.error)),
    // breadcrumbNav(state, actions),
    // backButton(state, actions),
    // objInfo(state, actions),
    linkedObjsSection(state, actions),
    copyObjsSection(state, actions),
    similarData(state, actions)
  ])
}

function formatDate (date) {
  return date.getMonth() + '/' + date.getDate() + '/' + date.getFullYear()
}

/*
function breadcrumbNav (state, actions) {
  if (!state.navHistory || !state.navHistory.length) return ''
  const items = state.navHistory.map((item, idx) => {
    return h('li', {
      class: 'inline-block breadcrumb'
    }, [
      h('a', {
        onclick: () => {
          console.log('going back..')
          const jumpTo = state.navHistory[idx]
          actions.update({ navHistory: state.navHistory.slice(0, idx + 1) })
          actions.setObject({ name: jumpTo.name, upa: jumpTo.upa })
        }
      }, item.name)
    ])
  }).slice(Math.max(state.navHistory.length - 3, 0)) // Only take the last 3 items
  return h('ul', {
    class: 'm0 p0',
    style: {
      overflow: 'hidden',
      whiteSpace: 'nowrap'
    }
  }, items)
}
*/

/*
// Navigation back button
function backButton (state, actions) {
  console.log('nav history', state.navHistory)
  if (!state.navHistory || !(state.navHistory.length > 1)) return ''
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
*/

/*
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
*/

// A bit more readable ternary conditional for use in views
// Display the vnode if the boolean is truthy
// Can pass a plain vnode or a function that returns a vnode
function showIf (bool, vnode) {
  if (bool) {
    return typeof vnode === 'function' ? vnode() : vnode
  }
  return ''
}

// Section of linked objects -- "Linked data"
function linkedObjsSection (state, actions) {
  if (state.loadingLinks) {
    return h('p', {class: 'muted bold'}, 'Loading related data...')
  }
  if (!state.links || !state.links.links.length) {
    return h('p', {class: 'muted'}, 'There are no objects linked to this one.')
  }
  const links = state.links.links
  return h('div', {class: 'clearfix'}, [
    header('Linked Data', links.length),
    filterTools(),
    h('div', {}, links.map(link => dataSection(link, state, actions)))
  ])
}

// Copied objects section
function copyObjsSection (state, actions) {
  if (state.loadingCopies) {
    return h('p', {class: 'bold muted'}, 'Loading copies...')
  }
  if (!state.copies || !state.copies.copies.length) {
    return h('p', {class: 'muted'}, 'There are no copies of this object.')
  }
  const copies = state.copies.copies
  // const sublinks = state.copies.sublinks
  return h('div', {class: 'clearfix mt2'}, [
    header('Copies', copies.length),
    filterTools(),
    h('div', {}, copies.map(copy => dataSection(copy, state, actions)))
  ])
}

// Similar data section (search results from the assembly homology service)
function similarData (state, actions) {
  if (state.searching) {
    return h('p', {
      class: 'muted bold'
    }, 'Searching for similar data (can take up to 30 seconds)...')
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
            actions.followLink({ name: entryName, upa })
          }
        }, entryName),
        h('span', { class: 'muted' }, [' (', readableNS, ')'])
      ])
    ])
  ])
}

// Section of parent data, with circle icon
function dataSection (entry, state, actions) {
  const hrefs = objHrefs(entry)
  // sublinks = sublinks.filter(l => l.parent_id === entry._id)
  const entryName = entry.obj_name
  return h('div', {}, [
    h('div', {
      class: 'h3-5 mt1 clearfix relative result-row',
      style: {'whiteSpace': 'nowrap'},
      onclick: ev => { actions.expandEntry(entry) }
    }, [
      showIf(entry.expanded, () => h('span', { class: 'circle-line' })),
      h('span', {class: 'mr1 circle inline-block'}, ''),
      h('h4', {class: 'inline-block m0 p0 bold'}, entryName),
      h('span', {
        class: 'block bold muted h0-5',
        style: {
          paddingLeft: '32px',
          fontSize: '0.85rem',
          paddingTop: '2px'
        }
      }, [
        typeName(entry.ws_type),
        ' · ',
        entry.owner
      ])
    ]),
    // - Narrative name and link
    // - Author name and link
    // - Save date
    showIf(entry.expanded, () => h('div', {
      class: 'relative mb1 mt1',
      style: { paddingLeft: '32px' }
    }, [
      h('span', {
        class: 'circle-line',
        style: { top: '-0.5rem' }
      }),
      h('div', {style: {marginBottom: '0.15rem'}}, [
        h('a', {href: hrefs.obj, target: '_blank'}, 'Full details for this object'),
        h('div', { class: 'my1' }, [
          'Created on ',
          formatDate(new Date(entry.save_date)),
          ' by ',
          h('a', {href: hrefs.owner, target: '_blank'}, entry.owner),
          ' in the narrative ',
          h('a', {href: hrefs.narrative, target: '_blank'}, entry.narr_name)
        ])
      ]),
      showIf(
        entry.sublinks && entry.sublinks.length === 0,
        () => h('div', { class: 'muted' }, 'No further related data found.')
      ),
      showIf(entry.sublinks && entry.sublinks.length, () => h('div', {}, [
        h('h4', {class: 'bold my1 muted'}, 'Related Objects'),
        h('table', {
          class: 'table-lined'
        }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, [ 'Object' ]),
              h('th', {}, [ 'Type' ]),
              h('th', {}, [ 'Narrative' ]),
              h('th', {}, [ 'Author' ])
            ])
          ]),
          h('tbody', {},
            entry.sublinks.map(subentry => subDataSection(subentry, entry, state, actions))
          )
        ])
      ]))
    ]))
  ])
}

// Section of sublinked objects with little graph lines
function subDataSection (subentry, entry, state, actions) {
  const hrefs = objHrefs(subentry)
  return h('tr', {}, [
    h('td', {}, [
      h('a', { href: hrefs.obj, target: '_blank' }, subentry.obj_name)
    ]),
    h('td', {}, [ typeName(subentry.ws_type) ]),
    h('td', {}, [
      h('a', { href: hrefs.narrative, target: '_blank' }, subentry.narr_name)
    ]),
    h('td', {}, [
      h('a', { href: hrefs.owner, target: '_blank' }, subentry.owner)
    ])
  ])
}

/*
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
*/

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
const appActions = app(state, actions, view, container)

// This UI is used in an iframe, so we receive post messages from a parent window
window.addEventListener('message', receiveMessage, false)
window._env = {
  kbaseEndpoint: 'https://ci.kbase.us',
  sketchURL: 'https://kbase.us/dynserv/78a20dfaa6b39390ec2da8c02ccf8f1a7fc6198a.sketch-service',
  relEngURL: 'https://ci.kbase.us/services/relation_engine_api',
  authToken: null
}
function receiveMessage (ev) {
  let data
  try {
    data = JSON.parse(ev.data)
  } catch (e) {
    console.error(e)
    return
  }
  if (!(data.method in window._messageHandlers)) {
    console.error('Unknown method: ' + data.method)
    console.log('Docs: ' + 'https://github.com/kbaseincubator/object_relations_ui')
    return
  }
  window._messageHandlers[data.method](data.params)
}

window._messageHandlers = {
  setUPA: function (params) {
    const upa = params.upa
    const name = params.name || ('Object ' + upa)
    appActions.followLink({ name, upa })
  },
  setKBaseEndpoint: function (params) {
    window._env.kbaseEndpoint = params.url.replace(/\/$/, '')
  },
  setRelEngURL: function (params) {
    window._env.relEngURL = params.url.replace(/\/$/, '')
  },
  setSketchURL: function (params) {
    window._env.sketchURL = params.url.replace(/\/$/, '')
  },
  setAuthToken: function (params) {
    window._env.authToken = params.token
  }
}

// TODO remove this -- testing purposes only
window._messageHandlers.setUPA({ upa: '15/8/1' })
