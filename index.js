const { h, app } = require('hyperapp')
const { fetchLinkedObjs, fetchCopies, fetchHomologs } = require('./utils/apiClients')
const serialize = require('form-serialize')

const icons = require('./utils/icons')
const showIf = require('./utils/showIf')
// const checkbox = require('./utils/checkbox')
// const filterDropdown = require('./utils/filterDropdown')

/* TODO
- remove dupes in the object results
- close dropdown on escape key (in document focus)
- allow multiple dropdowns open, and close them all on document click
- filter type dropdown functionality
- owner dropdown UI and data
- owner dropdown filter functionality
- public and private filter functionality
- show object aggregate details ("knowledge score") at top
  - total number of copies and links regardless of perms
- basic browser compat testing
extras
- sort nested related tables by column
*/

const state = { obj: {} }

const actions = {
  // Click an object to expand its link results
  expandEntry: (entry) => (state, actions) => {
    const upa = entry._key.replace(/:/g, '/')
    entry.expanded = !entry.expanded
    entry.loading = true
    if (!entry.sublinks || !entry.sublinks.length) {
      fetchLinkedObjs([upa], window._env.authToken)
        .then(results => {
          if (results && results.links) {
            entry.sublinks = results.links
          } else {
            entry.sublinks = []
          }
          entry.loading = false
          actions.update({})
        })
        .catch(err => {
          entry.loading = false
          console.error(err)
        })
    }
    actions.update({})
  },
  setObject: ({ name, upa }) => (state, actions) => {
    upa = upa.replace(/\//g, ':') // replace '/' with ':' (arangodb stores colon as the delimiter)
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
  function logError (err) {
    console.log(err)
    console.trace()
  }
  // Fetch all objects linked by reference or by provenance
  fetchLinkedObjs([state.upa], window._env.authToken)
    .then(results => {
      console.log('linked results', results)
      // Get an object of type names for filtering these results
      if (results) {
        const types = getTypeArray(results.links)
        actions.update({ links: results, linkTypes: types })
      }
      actions.update({ loadingLinks: false })
    })
    .catch(err => {
      actions.update({ error: String(err), loadingLinks: false })
      logError(err)
    })
  // Fetch all copies of this object, either upstream or downstream
  fetchCopies(state.upa)
    .then(results => {
      console.log('copy results', results)
      // Get an object of type names for filtering these results
      if (results) {
        const types = getTypeArray(results.copies)
        actions.update({ copies: results, copyTypes: types })
      }
      actions.update({ loadingCopies: false })
    })
    .catch(err => {
      actions.update({ error: String(err), loadingCopies: false })
      logError(err)
    })
  // Do an assembly homology search on the object, then fetch all linked objects for each search result
  actions.update({ searching: true })
  fetchHomologs(state.upa)
    .then(results => {
      console.log('homology results', results)
      if (!results || !results.length) return
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
    .catch(err => {
      actions.update({ error: String(err), searching: false })
      logError(err)
    })
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
  const rootUrl = window._env.kbaseRootUrl
  const dataview = rootUrl + '/#dataview/'
  const typeUrl = rootUrl + '/#spec/type/'
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
    hrefs.narrative = rootUrl + '/narrative/' + obj.workspace_id
  }
  if (obj.owner) {
    hrefs.owner = rootUrl + '/#people/' + obj.owner
  }
  return hrefs
}

// Top-level view function
function view (state, actions) {
  window.state = state // for debugging
  const formElem = showIf(window.location.search === '?form', () => form(state, actions))
  // No results found for this object -- show a simple message
  if (!state.loadingCopies && !state.loadingLinks && !state.links && !state.copies) {
    return h('div', {class: 'container p2 dropdown'}, [
      formElem,
      h('p', {}, 'No results found.')
    ])
  }
  return h('div', {class: 'container p2 max-width-3'}, [
    formElem,
    showIf(state.error, h('p', { class: 'error' }, state.error)),
    // objInfo(state, actions),
    h('p', {}, [h('strong', {}, '47'), ' total related objects']),
    linkedObjsSection(state, actions),
    copyObjsSection(state, actions),
    similarData(state, actions)
  ])
}

function form (state, actions) {
  return h('form', {
    class: 'mb3',
    onsubmit: ev => {
      ev.preventDefault()
      const formData = serialize(ev.currentTarget, { hash: true })
      window._messageHandlers.setKBaseEndpoint({ url: formData.endpoint })
      window._messageHandlers.setAuthToken({ token: formData.token })
      window._messageHandlers.setUPA({ upa: formData.upa })
      newSearch(state, actions, state.upa)
    }
  }, [
    h('fieldset', {class: 'inline-block mr2'}, [
      h('label', {class: 'block mb2 bold'}, 'KBase endpoint'),
      h('input', {
        class: 'input p1',
        required: true,
        type: 'text',
        name: 'endpoint',
        value: window._env.kbaseEndpoint
      })
    ]),
    h('fieldset', {class: 'inline-block mr2'}, [
      h('label', {class: 'block mb2 bold'}, 'Auth token'),
      h('input', {
        class: 'input p1',
        type: 'password',
        name: 'token',
        value: window._env.authToken
      })
    ]),
    h('fieldset', {class: 'inline-block'}, [
      h('label', {class: 'block mb2 bold'}, 'Object address'),
      h('input', {
        placeholder: '1/2/3',
        class: 'input p1',
        required: true,
        type: 'text',
        name: 'upa',
        value: state.upa
      })
    ]),
    h('fieldset', {class: 'clearfix col-12 pt2'}, [
      h('button', {class: 'btn', type: 'submit'}, 'Submit')
    ])
  ])
}

function formatDate (date) {
  return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear()
}

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

// Section of linked objects -- "Linked data"
function linkedObjsSection (state, actions) {
  if (state.loadingLinks) {
    return h('div', {}, [
      header('Linked Data', 'Loading...'),
      loadingBoxes()
    ])
    // return h('p', {class: 'muted bold'}, 'Loading related data...')
  }
  if (!state.links || !state.links.links.length) {
    return h('p', {class: 'muted'}, 'There are no objects linked to this one.')
  }
  const links = state.links.links
  return h('div', {}, [
    header('Linked Data', links.length + ' total'),
    /*
    filterTools({
      list: links,
      types: state.linkTypes,
      listName: 'links'
    }, state, actions),
    */
    h('div', {}, links.map(link => {
      // Subtitle text under the header for each link result
      const subText = [typeName(link.ws_type), link.owner]
      return dataSection(link, subText, state, actions)
    }))
  ])
}

// Copied objects section
function copyObjsSection (state, actions) {
  if (state.loadingCopies) {
    return h('div', {}, [
      header('Copies', 'Loading...'),
      loadingBoxes()
    ])
  }
  if (!state.copies || !state.copies.copies.length) {
    return h('p', {class: 'muted no-results'}, 'There are no copies of this object.')
  }
  const copies = state.copies.copies
  // const sublinks = state.copies.sublinks
  return h('div', {class: 'clearfix mt2'}, [
    header('Copies', copies.length + ' total'),
    /*
    filterTools({
      list: copies,
      types: state.copyTypes,
      listName: 'copies'
    }, state, actions),
    */
    h('div', {}, copies.map(copy => {
      // Subtitle text under the header for each link result
      const subText = [typeName(copy.ws_type), copy.owner]
      return dataSection(copy, subText, state, actions)
    }))
  ])
}

// Similar data section (search results from the assembly homology service)
function similarData (state, actions) {
  if (state.searching) {
    return h('div', {}, [
      header('Similar Data', 'Loading...'),
      loadingBoxes()
    ])
  }
  if (!state.similar || !state.similar.length) return ''
  return h('div', { class: 'clearfix mt2' }, [
    header('Similar data', state.similar.length + ' total'),
    h('div', {}, state.similar.map(entry => {
      const readableNS = entry.namespaceid.replace('_', ' ')
      let distance
      if (entry.dist === 0) {
        distance = 'exact match'
      } else {
        distance = entry.dist + ' distance'
      }
      const subText = [distance, readableNS]
      entry.ws_type = 'Assembly' // TODO check for other types somehow
      entry.obj_name = entry.sciname || entry.sourceid
      if (entry.kbase_id) {
        entry._key = entry.kbase_id.replace(/\//g, ':')
      }
      return dataSection(entry, subText, state, actions)
    }))
  ])
}

// Section of parent data, with circle icon
// You can pass in some subtext (array of strings), which goes below the main title
function dataSection (entry, subText, state, actions) {
  if (entry.hidden) return ''
  const hrefs = objHrefs(entry)
  // sublinks = sublinks.filter(l => l.parent_id === entry._id)
  const entryName = entry.obj_name
  const type = typeName(entry.ws_type)
  const iconColor = icons.colors[type]
  const iconInitial = type.split('').filter(c => c === c.toUpperCase()).slice(0, 3).join('')
  return h('div', {}, [
    h('div', {
      class: 'h3-5 mt1 clearfix relative result-row hover-parent',
      style: {'whiteSpace': 'nowrap'},
      onclick: ev => {
        if (entry._key) actions.expandEntry(entry)
      }
    }, [
      showIf(entry.expanded, () => h('span', { style: { background: iconColor }, class: 'circle-line' })),
      h('span', {
        class: `mr1 circle inline-block ${entry.expanded ? 'hover-caret-up' : 'hover-caret-down'}`,
        style: { background: iconColor }
      }, [
        h('span', { class: 'hover-hide' }, [iconInitial]),
        h('span', { class: 'hover-arrow hover-inline-block' }, entry.expanded ? '⭡' : '⭣')
      ]),
      h('h4', { class: 'm0 p0 bold', style: { paddingLeft: '32px' } }, [
        entryName,
        showIf(!entry.expanded, () => h('span', { class: 'caret-up' })),
        showIf(entry.expanded, () => h('span', { class: 'caret-down' }))
      ]),
      h('span', {
        class: 'block bold muted h0-5',
        style: {
          paddingLeft: '32px',
          fontSize: '0.85rem',
          paddingTop: '2px'
        }
      }, subText.join(' · '))
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
        style: { top: '-0.5rem', background: iconColor }
      }),
      h('div', {style: {marginBottom: '0.15rem'}}, [
        h('a', {href: hrefs.obj, target: '_blank'}, 'Full details'),
        showIf(entry.save_date, () =>
          h('div', { class: 'my1' }, [
            'Created on ',
            formatDate(new Date(entry.save_date)),
            ' by ',
            h('a', {href: hrefs.owner, target: '_blank'}, entry.owner),
            ' in the narrative ',
            h('a', {href: hrefs.narrative, target: '_blank'}, entry.narr_name)
          ])
        )
      ]),
      showIf(entry.loading && !(entry.sublinks && entry.sublinks.length), () => h('div', {}, [
        h('p', {class: 'bold my1 muted'}, 'Loading related objects...'),
        loadingTable()
      ])),
      showIf(
        entry.sublinks && entry.sublinks.length === 0,
        () => h('div', { class: 'muted' }, 'No further related data found.')
      ),
      showIf(entry.sublinks && entry.sublinks.length, () => h('div', {}, [
        h('h4', {class: 'bold my1 muted'}, entry.sublinks.length + ' Related Objects'),
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
  return h('tr', { class: 'semi-muted' }, [
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

// Filter results
// `listName` should be one of 'links', 'copies', or 'similar'
// `types` should be a list of types to filter on (eg. state.linkTypes)
// `list` should be a list of objects (eg. state.links.links)
function filterTools ({types, list, listName}, state, actions) {
  const typeFilter = h('button', {
    class: 'btn'
  }, 'Type')
  const ownerFilter = h('button', { class: 'ml1 btn' }, 'Owner')
  /*
  const typeFilter = filterDropdown({
    id: 'filter-dropdown-' + listName,
    text: 'Type',
    onchange: (filters) => {
      actions.applyFilters(filters)
    },
    options: types || []
  }, state, actions)
  */
  // Set default state for some of the elements in here
  // const privCheckboxPath = [listName, 'filter-checkbox-private']
  // const pubCheckboxPath = [listName, 'filter-checkbox-public']
  // const privCheckbox = scope({
  //   scope: [listName, 'checkbox-private'],
  //   state,
  //   actions,
  //   defaults: { text: 'Private', name: 'Private', checked: true }
  // })
  // setDefault(privCheckboxPath, checkbox.create)
  // setDefault(pubCheckboxPath, checkbox.create)
  return h('div', { class: 'pb1' }, [
    h('span', {
      class: 'inline-block mr1 align-middle'
    }, 'Filter by '),
    typeFilter,
    ownerFilter,
    // h('button', {class: 'btn mr2'}, 'Owner'),
    h('span', { class: 'inline-block ml1 align-middle' }, [
      h('input', { type: 'checkbox' }),
      h('span', {}, 'Public')
      // checkbox.view(scope(state, 'public-checkbox-' + listName), actions)
    ]),
    h('span', { class: 'inline-block ml2 align-middle' }, [
      h('input', { type: 'checkbox' }),
      h('span', {}, 'Private')
      /*
      filterDropdown({
        path: [listName, 'filter-type']
      })
      checkbox({
        path: [listName, 'checkbox-private'],
        defaults: { text: 'Private', name: 'Private', checked: true },
        state,
        actions,
        onchange
      })
      checkbox({
        id: 'checkbox-private-' + listName,
        text: 'Private',
        name: 'private',
        checked: true
      }, state, actions)
      */
    ])
  ])
}

// Section header
function header (text, rightText) {
  return h('div', {class: 'my2 py1 border-bottom'}, [
    h('h2', {class: 'inline-block m0 h3'}, text),
    h('span', {class: 'right inline-block'}, [rightText])
  ])
}

function loadingBoxes () {
  const background = '#eee'
  const row = () => {
    return h('div', { class: 'mt2' }, [
      h('div', {
        class: 'inline-block',
        style: {
          width: '30px',
          height: '30px',
          borderRadius: '40px',
          background
        }
      }),
      h('div', {
        class: 'inline-block ml2',
        style: {
          width: '300px',
          height: '30px',
          background
        }
      })
    ])
  }
  return h('div', {}, [ row(), row(), row(), row() ])
}

function loadingTable () {
  const background = '#eee'
  const td = () => {
    return h('td', {
      class: 'inline-block mr2 mb2',
      style: {
        height: '20px',
        width: '200px',
        background
      }
    })
  }
  const row = () => {
    return h('tr', {}, [ td(), td(), td() ])
  }
  return h('table', {}, [
    row(), row(), row()
  ])
}

// Render to the page
const container = document.querySelector('#hyperapp-container')
const appActions = app(state, actions, view, container)
window.appActions = appActions

// This UI is used in an iframe, so we receive post messages from a parent window
window.addEventListener('message', receiveMessage, false)
// Default app config -- overridden by postMessage handlers further below
window._env = {
  kbaseEndpoint: 'https://ci.kbase.us',
  sketchURL: 'https://kbase.us/dynserv/667eef100933005650909556d078328242b1d3ab.sketch-service',
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
    appActions.setObject({ name, upa })
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
  },
  setRootUrl: function (params) {
    window._env.kbaseRootUrl = params.url.replace(/\/$/, '')
  }
}

// From a collection of objects, get an array of readable type names
function getTypeArray (objects) {
  return Object.keys(objects.reduce((obj, link) => {
    obj[typeName(link.ws_type)] = true
    return obj
  }, {}))
}

// TODO remove this -- testing purposes only
// window._messageHandlers.setAuthToken({ token: 'LPIX46RNMMHGUGM2KHNAS6JSLQBYYVH4' })
window._messageHandlers.setRootUrl({ url: 'https://narrative-dev.kbase.us' })
window._messageHandlers.setAuthToken({ token: 'AASKV2ZWFVDU375FV6Y6NHF2QUYA6S76' })
window._messageHandlers.setKBaseEndpoint({ url: 'https://kbase.us/services' })
window._messageHandlers.setRelEngURL({ url: 'https://kbase.us/services/relation_engine_api' })
window._messageHandlers.setUPA({ upa: '39686/45/1' })
