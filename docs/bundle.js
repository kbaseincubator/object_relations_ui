(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var _require = require('hyperapp'),
    h = _require.h,
    app = _require.app;

var _require2 = require('./utils/apiClients'),
    fetchLinkedObjs = _require2.fetchLinkedObjs,
    fetchCopies = _require2.fetchCopies,
    fetchHomologs = _require2.fetchHomologs;

var serialize = require('form-serialize');

var icons = require('./utils/icons');
var showIf = require('./utils/showIf');
// const checkbox = require('./utils/checkbox')
// const filterDropdown = require('./utils/filterDropdown')

/* TODO
- convert to components
- filter type dropdown ++
- owner dropdown ++
- public and private filters ++
- ++ object aggregate details ("knowledge score") ++
  - total number of copies and links regardless of perms
- basic browser compat testing
extras
- sort nested related tables by column
*/

var state = { obj: {} };

var actions = {
  // Click an object to expand its link results
  expandEntry: function (entry) {
    return function (state, actions) {
      var upa = entry._key.replace(/:/g, '/');
      entry.expanded = !entry.expanded;
      entry.loading = true;
      if (!entry.sublinks || !entry.sublinks.length) {
        fetchLinkedObjs([upa], window._env.authToken).then(function (results) {
          if (results && results.links) {
            entry.sublinks = results.links;
          } else {
            entry.sublinks = [];
          }
          entry.loading = false;
          actions.update({});
        }).catch(function (err) {
          entry.loading = false;
          console.error(err);
        });
      }
      actions.update({});
    };
  },
  setObject: function (_ref) {
    var name = _ref.name,
        upa = _ref.upa;
    return function (state, actions) {
      upa = upa.replace(/\//g, ':'); // replace '/' with ':' (arangodb stores colon as the delimiter)
      var obj = { obj_name: name, upa: upa };
      actions.update({ obj: obj, upa: upa });
      newSearch(state, actions, upa);
    };
  },
  update: function (state) {
    return function () {
      return state;
    };
  }

  // Perform a full fetch on an object
  // This performs serveral fetches on a couple services
};function newSearch(state, actions, upa) {
  // Reset all the state, clear out results
  state.upa = upa;
  actions.update({
    upa: upa,
    similarLinked: null,
    similar: null,
    copies: null,
    links: null,
    error: null,
    loadingCopies: true,
    loadingLinks: true
  });
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
  function logError(err) {
    console.log(err);
    console.trace();
  }
  // Fetch all objects linked by reference or by provenance
  fetchLinkedObjs([state.upa], window._env.authToken).then(function (results) {
    console.log('linked results', results);
    // Get an object of type names for filtering these results
    if (results) {
      var types = getTypeArray(results.links);
      actions.update({ links: results, linkTypes: types });
    }
    actions.update({ loadingLinks: false });
  }).catch(function (err) {
    actions.update({ error: String(err), loadingLinks: false });
    logError(err);
  });
  // Fetch all copies of this object, either upstream or downstream
  fetchCopies(state.upa).then(function (results) {
    console.log('copy results', results);
    // Get an object of type names for filtering these results
    if (results) {
      var types = getTypeArray(results.copies);
      actions.update({ copies: results, copyTypes: types });
    }
    actions.update({ loadingCopies: false });
  }).catch(function (err) {
    actions.update({ error: String(err), loadingCopies: false });
    logError(err);
  });
  // Do an assembly homology search on the object, then fetch all linked objects for each search result
  actions.update({ searching: true });
  fetchHomologs(state.upa).then(function (results) {
    console.log('homology results', results);
    if (!results || !results.length) return;
    actions.update({ similar: results });
    var kbaseResults = results.filter(function (r) {
      return 'kbase_id' in r;
    }).map(function (r) {
      return r.kbase_id.replace(/\//g, ':');
    });
    console.log('kbase results', kbaseResults);
    // TODO Find all linked objects for each results with a kbase_id
    return fetchLinkedObjs(kbaseResults, window._env.authToken);
  }).then(function (results) {
    console.log('homology link results', results);
    actions.update({ similarLinked: results, searching: false });
  }).catch(function (err) {
    actions.update({ error: String(err), searching: false });
    logError(err);
  });
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
function typeName(typeStr) {
  var matches = typeStr.match(/^.+\.(.+)-.+$/);
  if (!matches) return typeStr;
  return matches[1];
}

// Generate KBase url links for an object
function objHrefs(obj) {
  var rootUrl = window._env.kbaseRootUrl;
  var dataview = rootUrl + '/#dataview/';
  var typeUrl = rootUrl + '/#spec/type/';
  var hrefs = {};
  if (obj.ws_type) {
    hrefs.type = typeUrl + obj.ws_type;
  }
  if (obj.upa) {
    hrefs.obj = dataview + obj.upa;
  } else if (obj._key) {
    hrefs.obj = dataview + obj._key.replace(/:/g, '/');
  }
  if (obj.workspace_id) {
    hrefs.narrative = rootUrl + '/narrative/' + obj.workspace_id;
  }
  if (obj.owner) {
    hrefs.owner = rootUrl + '/#people/' + obj.owner;
  }
  return hrefs;
}

// Top-level view function
function view(state, actions) {
  window.state = state; // for debugging
  var formElem = showIf(window.location.search === '?form', function () {
    return form(state, actions);
  });
  // No results found for this object -- show a simple message
  if (!state.loadingCopies && !state.loadingLinks && !state.links && !state.copies) {
    return h('div', { class: 'container p2 dropdown' }, [formElem, h('p', {}, 'No results found.')]);
  }
  return h('div', { class: 'container p2 max-width-3' }, [formElem, showIf(state.error, h('p', { class: 'error' }, state.error)),
  // objInfo(state, actions),
  h('p', {}, [h('strong', {}, '47'), ' total related objects']), linkedObjsSection(state, actions), copyObjsSection(state, actions), similarData(state, actions)]);
}

function form(state, actions) {
  return h('form', {
    class: 'mb3',
    onsubmit: function (ev) {
      ev.preventDefault();
      var formData = serialize(ev.currentTarget, { hash: true });
      window._messageHandlers.setKBaseEndpoint({ url: formData.endpoint });
      window._messageHandlers.setAuthToken({ token: formData.token });
      window._messageHandlers.setUPA({ upa: formData.upa });
      newSearch(state, actions, state.upa);
    }
  }, [h('fieldset', { class: 'inline-block mr2' }, [h('label', { class: 'block mb2 bold' }, 'KBase endpoint'), h('input', {
    class: 'input p1',
    required: true,
    type: 'text',
    name: 'endpoint',
    value: window._env.kbaseEndpoint
  })]), h('fieldset', { class: 'inline-block mr2' }, [h('label', { class: 'block mb2 bold' }, 'Auth token'), h('input', {
    class: 'input p1',
    type: 'password',
    name: 'token',
    value: window._env.authToken
  })]), h('fieldset', { class: 'inline-block' }, [h('label', { class: 'block mb2 bold' }, 'Object address'), h('input', {
    placeholder: '1/2/3',
    class: 'input p1',
    required: true,
    type: 'text',
    name: 'upa',
    value: state.upa
  })]), h('fieldset', { class: 'clearfix col-12 pt2' }, [h('button', { class: 'btn', type: 'submit' }, 'Submit')])]);
}

function formatDate(date) {
  return date.getMonth() + 1 + '/' + date.getDate() + '/' + date.getFullYear();
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
function linkedObjsSection(state, actions) {
  if (state.loadingLinks) {
    return h('div', {}, [header('Linked Data', 'Loading...'), loadingBoxes()]);
    // return h('p', {class: 'muted bold'}, 'Loading related data...')
  }
  if (!state.links || !state.links.links.length) {
    return h('p', { class: 'muted' }, 'There are no objects linked to this one.');
  }
  var links = state.links.links;
  return h('div', {}, [header('Linked Data', links.length + ' total'),
  /*
  filterTools({
    list: links,
    types: state.linkTypes,
    listName: 'links'
  }, state, actions),
  */
  h('div', {}, links.map(function (link) {
    // Subtitle text under the header for each link result
    var subText = [typeName(link.ws_type), link.owner];
    return dataSection(link, subText, state, actions);
  }))]);
}

// Copied objects section
function copyObjsSection(state, actions) {
  if (state.loadingCopies) {
    return h('div', {}, [header('Copies', 'Loading...'), loadingBoxes()]);
  }
  if (!state.copies || !state.copies.copies.length) {
    return h('p', { class: 'muted no-results' }, 'There are no copies of this object.');
  }
  var copies = state.copies.copies;
  // const sublinks = state.copies.sublinks
  return h('div', { class: 'clearfix mt2' }, [header('Copies', copies.length + ' total'),
  /*
  filterTools({
    list: copies,
    types: state.copyTypes,
    listName: 'copies'
  }, state, actions),
  */
  h('div', {}, copies.map(function (copy) {
    // Subtitle text under the header for each link result
    var subText = [typeName(copy.ws_type), copy.owner];
    return dataSection(copy, subText, state, actions);
  }))]);
}

// Similar data section (search results from the assembly homology service)
function similarData(state, actions) {
  if (state.searching) {
    return h('div', {}, [header('Similar Data', 'Loading...'), loadingBoxes()]);
  }
  if (!state.similar || !state.similar.length) return '';
  return h('div', { class: 'clearfix mt2' }, [header('Similar data', state.similar.length + ' total'), h('div', {}, state.similar.map(function (entry) {
    var readableNS = entry.namespaceid.replace('_', ' ');
    var distance = void 0;
    if (entry.dist === 0) {
      distance = 'exact match';
    } else {
      distance = entry.dist + ' distance';
    }
    var subText = [distance, readableNS];
    entry.ws_type = 'Assembly'; // TODO check for other types somehow
    entry.obj_name = entry.sciname || entry.sourceid;
    if (entry.kbase_id) {
      entry._key = entry.kbase_id.replace(/\//g, ':');
    }
    return dataSection(entry, subText, state, actions);
  }))]);
}

// Section of parent data, with circle icon
// You can pass in some subtext (array of strings), which goes below the main title
function dataSection(entry, subText, state, actions) {
  if (entry.hidden) return '';
  var hrefs = objHrefs(entry);
  // sublinks = sublinks.filter(l => l.parent_id === entry._id)
  var entryName = entry.obj_name;
  var type = typeName(entry.ws_type);
  var iconColor = icons.colors[type];
  var iconInitial = type.split('').filter(function (c) {
    return c === c.toUpperCase();
  }).slice(0, 3).join('');
  return h('div', {}, [h('div', {
    class: 'h3-5 mt1 clearfix relative result-row hover-parent',
    style: { 'whiteSpace': 'nowrap' },
    onclick: function (ev) {
      if (entry._key) actions.expandEntry(entry);
    }
  }, [showIf(entry.expanded, function () {
    return h('span', { style: { background: iconColor }, class: 'circle-line' });
  }), h('span', {
    class: 'mr1 circle inline-block ' + (entry.expanded ? 'hover-caret-up' : 'hover-caret-down'),
    style: { background: iconColor }
  }, [h('span', { class: 'hover-hide' }, [iconInitial]), h('span', { class: 'hover-arrow hover-inline-block' }, entry.expanded ? '⭡' : '⭣')]), h('h4', { class: 'm0 p0 bold', style: { paddingLeft: '32px' } }, [entryName, showIf(!entry.expanded, function () {
    return h('span', { class: 'caret-up' });
  }), showIf(entry.expanded, function () {
    return h('span', { class: 'caret-down' });
  })]), h('span', {
    class: 'block bold muted h0-5',
    style: {
      paddingLeft: '32px',
      fontSize: '0.85rem',
      paddingTop: '2px'
    }
  }, subText.join(' · '))]),
  // - Narrative name and link
  // - Author name and link
  // - Save date
  showIf(entry.expanded, function () {
    return h('div', {
      class: 'relative mb1 mt1',
      style: { paddingLeft: '32px' }
    }, [h('span', {
      class: 'circle-line',
      style: { top: '-0.5rem', background: iconColor }
    }), h('div', { style: { marginBottom: '0.15rem' } }, [h('a', { href: hrefs.obj, target: '_blank' }, 'Full details'), showIf(entry.save_date, function () {
      return h('div', { class: 'my1' }, ['Created on ', formatDate(new Date(entry.save_date)), ' by ', h('a', { href: hrefs.owner, target: '_blank' }, entry.owner), ' in the narrative ', h('a', { href: hrefs.narrative, target: '_blank' }, entry.narr_name)]);
    })]), showIf(entry.loading && !(entry.sublinks && entry.sublinks.length), function () {
      return h('div', {}, [h('p', { class: 'bold my1 muted' }, 'Loading related objects...'), loadingTable()]);
    }), showIf(entry.sublinks && entry.sublinks.length === 0, function () {
      return h('div', { class: 'muted' }, 'No further related data found.');
    }), showIf(entry.sublinks && entry.sublinks.length, function () {
      return h('div', {}, [h('h4', { class: 'bold my1 muted' }, entry.sublinks.length + ' Related Objects'), h('table', {
        class: 'table-lined'
      }, [h('thead', {}, [h('tr', {}, [h('th', {}, ['Object']), h('th', {}, ['Type']), h('th', {}, ['Narrative']), h('th', {}, ['Author'])])]), h('tbody', {}, entry.sublinks.map(function (subentry) {
        return subDataSection(subentry, entry, state, actions);
      }))])]);
    })]);
  })]);
}

// Section of sublinked objects with little graph lines
function subDataSection(subentry, entry, state, actions) {
  var hrefs = objHrefs(subentry);
  return h('tr', { class: 'semi-muted' }, [h('td', {}, [h('a', { href: hrefs.obj, target: '_blank' }, subentry.obj_name)]), h('td', {}, [typeName(subentry.ws_type)]), h('td', {}, [h('a', { href: hrefs.narrative, target: '_blank' }, subentry.narr_name)]), h('td', {}, [h('a', { href: hrefs.owner, target: '_blank' }, subentry.owner)])]);
}

// Filter results
// `listName` should be one of 'links', 'copies', or 'similar'
// `types` should be a list of types to filter on (eg. state.linkTypes)
// `list` should be a list of objects (eg. state.links.links)
function filterTools(_ref2, state, actions) {
  var types = _ref2.types,
      list = _ref2.list,
      listName = _ref2.listName;

  var typeFilter = h('button', {
    class: 'btn'
  }, 'Type');
  var ownerFilter = h('button', { class: 'ml1 btn' }, 'Owner');
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
  return h('div', { class: 'pb1' }, [h('span', {
    class: 'inline-block mr1 align-middle'
  }, 'Filter by '), typeFilter, ownerFilter,
  // h('button', {class: 'btn mr2'}, 'Owner'),
  h('span', { class: 'inline-block ml1 align-middle' }, [h('input', { type: 'checkbox' }), h('span', {}, 'Public')
  // checkbox.view(scope(state, 'public-checkbox-' + listName), actions)
  ]), h('span', { class: 'inline-block ml2 align-middle' }, [h('input', { type: 'checkbox' }), h('span', {}, 'Private')
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
  ])]);
}

// Section header
function header(text, rightText) {
  return h('div', { class: 'my2 py1 border-bottom' }, [h('h2', { class: 'inline-block m0 h3' }, text), h('span', { class: 'right inline-block' }, [rightText])]);
}

function loadingBoxes() {
  var background = '#eee';
  var row = function () {
    return h('div', { class: 'mt2' }, [h('div', {
      class: 'inline-block',
      style: {
        width: '30px',
        height: '30px',
        borderRadius: '40px',
        background: background
      }
    }), h('div', {
      class: 'inline-block ml2',
      style: {
        width: '300px',
        height: '30px',
        background: background
      }
    })]);
  };
  return h('div', {}, [row(), row(), row(), row()]);
}

function loadingTable() {
  var background = '#eee';
  var td = function () {
    return h('td', {
      class: 'inline-block mr2 mb2',
      style: {
        height: '20px',
        width: '200px',
        background: background
      }
    });
  };
  var row = function () {
    return h('tr', {}, [td(), td(), td()]);
  };
  return h('table', {}, [row(), row(), row()]);
}

// Render to the page
var container = document.querySelector('#hyperapp-container');
var appActions = app(state, actions, view, container);
window.appActions = appActions;

// This UI is used in an iframe, so we receive post messages from a parent window
window.addEventListener('message', receiveMessage, false);
// Default app config -- overridden by postMessage handlers further below
window._env = {
  kbaseEndpoint: 'https://ci.kbase.us',
  sketchURL: 'https://kbase.us/dynserv/667eef100933005650909556d078328242b1d3ab.sketch-service',
  relEngURL: 'https://ci.kbase.us/services/relation_engine_api',
  authToken: null
};
function receiveMessage(ev) {
  var data = void 0;
  try {
    data = JSON.parse(ev.data);
  } catch (e) {
    console.error(e);
    return;
  }
  if (!(data.method in window._messageHandlers)) {
    console.error('Unknown method: ' + data.method);
    console.log('Docs: ' + 'https://github.com/kbaseincubator/object_relations_ui');
    return;
  }
  window._messageHandlers[data.method](data.params);
}

window._messageHandlers = {
  setUPA: function (params) {
    var upa = params.upa;
    var name = params.name || 'Object ' + upa;
    appActions.setObject({ name: name, upa: upa });
  },
  setKBaseEndpoint: function (params) {
    window._env.kbaseEndpoint = params.url.replace(/\/$/, '');
  },
  setRelEngURL: function (params) {
    window._env.relEngURL = params.url.replace(/\/$/, '');
  },
  setSketchURL: function (params) {
    window._env.sketchURL = params.url.replace(/\/$/, '');
  },
  setAuthToken: function (params) {
    window._env.authToken = params.token;
  },
  setRootUrl: function (params) {
    window._env.kbaseRootUrl = params.url.replace(/\/$/, '');
  }

  // From a collection of objects, get an array of readable type names
};function getTypeArray(objects) {
  return Object.keys(objects.reduce(function (obj, link) {
    obj[typeName(link.ws_type)] = true;
    return obj;
  }, {}));
}

// Token below is revoked
// window._messageHandlers.setAuthToken({ token: 'LPIX46RNMMHGUGM2KHNAS6JSLQBYYVH4' })
// window._messageHandlers.setRootUrl({ url: 'https://narrative-dev.kbase.us' })
// window._messageHandlers.setAuthToken({ token: 'AASKV2ZWFVDU375FV6Y6NHF2QUYA6S76' })
// window._messageHandlers.setKBaseEndpoint({ url: 'https://kbase.us/services' })
// window._messageHandlers.setRelEngURL({ url: 'https://kbase.us/services/relation_engine_api' })
// window._messageHandlers.setUPA({ upa: '39686/45/1' })
},{"./utils/apiClients":4,"./utils/icons":5,"./utils/showIf":6,"form-serialize":2,"hyperapp":3}],2:[function(require,module,exports){
// get successful control from form and assemble into object
// http://www.w3.org/TR/html401/interact/forms.html#h-17.13.2

// types which indicate a submit action and are not successful controls
// these will be ignored
var k_r_submitter = /^(?:submit|button|image|reset|file)$/i;

// node names which could be successful controls
var k_r_success_contrls = /^(?:input|select|textarea|keygen)/i;

// Matches bracket notation.
var brackets = /(\[[^\[\]]*\])/g;

// serializes form fields
// @param form MUST be an HTMLForm element
// @param options is an optional argument to configure the serialization. Default output
// with no options specified is a url encoded string
//    - hash: [true | false] Configure the output type. If true, the output will
//    be a js object.
//    - serializer: [function] Optional serializer function to override the default one.
//    The function takes 3 arguments (result, key, value) and should return new result
//    hash and url encoded str serializers are provided with this module
//    - disabled: [true | false]. If true serialize disabled fields.
//    - empty: [true | false]. If true serialize empty fields
function serialize(form, options) {
    if (typeof options != 'object') {
        options = { hash: !!options };
    }
    else if (options.hash === undefined) {
        options.hash = true;
    }

    var result = (options.hash) ? {} : '';
    var serializer = options.serializer || ((options.hash) ? hash_serializer : str_serialize);

    var elements = form && form.elements ? form.elements : [];

    //Object store each radio and set if it's empty or not
    var radio_store = Object.create(null);

    for (var i=0 ; i<elements.length ; ++i) {
        var element = elements[i];

        // ingore disabled fields
        if ((!options.disabled && element.disabled) || !element.name) {
            continue;
        }
        // ignore anyhting that is not considered a success field
        if (!k_r_success_contrls.test(element.nodeName) ||
            k_r_submitter.test(element.type)) {
            continue;
        }

        var key = element.name;
        var val = element.value;

        // we can't just use element.value for checkboxes cause some browsers lie to us
        // they say "on" for value when the box isn't checked
        if ((element.type === 'checkbox' || element.type === 'radio') && !element.checked) {
            val = undefined;
        }

        // If we want empty elements
        if (options.empty) {
            // for checkbox
            if (element.type === 'checkbox' && !element.checked) {
                val = '';
            }

            // for radio
            if (element.type === 'radio') {
                if (!radio_store[element.name] && !element.checked) {
                    radio_store[element.name] = false;
                }
                else if (element.checked) {
                    radio_store[element.name] = true;
                }
            }

            // if options empty is true, continue only if its radio
            if (val == undefined && element.type == 'radio') {
                continue;
            }
        }
        else {
            // value-less fields are ignored unless options.empty is true
            if (!val) {
                continue;
            }
        }

        // multi select boxes
        if (element.type === 'select-multiple') {
            val = [];

            var selectOptions = element.options;
            var isSelectedOptions = false;
            for (var j=0 ; j<selectOptions.length ; ++j) {
                var option = selectOptions[j];
                var allowedEmpty = options.empty && !option.value;
                var hasValue = (option.value || allowedEmpty);
                if (option.selected && hasValue) {
                    isSelectedOptions = true;

                    // If using a hash serializer be sure to add the
                    // correct notation for an array in the multi-select
                    // context. Here the name attribute on the select element
                    // might be missing the trailing bracket pair. Both names
                    // "foo" and "foo[]" should be arrays.
                    if (options.hash && key.slice(key.length - 2) !== '[]') {
                        result = serializer(result, key + '[]', option.value);
                    }
                    else {
                        result = serializer(result, key, option.value);
                    }
                }
            }

            // Serialize if no selected options and options.empty is true
            if (!isSelectedOptions && options.empty) {
                result = serializer(result, key, '');
            }

            continue;
        }

        result = serializer(result, key, val);
    }

    // Check for all empty radio buttons and serialize them with key=""
    if (options.empty) {
        for (var key in radio_store) {
            if (!radio_store[key]) {
                result = serializer(result, key, '');
            }
        }
    }

    return result;
}

function parse_keys(string) {
    var keys = [];
    var prefix = /^([^\[\]]*)/;
    var children = new RegExp(brackets);
    var match = prefix.exec(string);

    if (match[1]) {
        keys.push(match[1]);
    }

    while ((match = children.exec(string)) !== null) {
        keys.push(match[1]);
    }

    return keys;
}

function hash_assign(result, keys, value) {
    if (keys.length === 0) {
        result = value;
        return result;
    }

    var key = keys.shift();
    var between = key.match(/^\[(.+?)\]$/);

    if (key === '[]') {
        result = result || [];

        if (Array.isArray(result)) {
            result.push(hash_assign(null, keys, value));
        }
        else {
            // This might be the result of bad name attributes like "[][foo]",
            // in this case the original `result` object will already be
            // assigned to an object literal. Rather than coerce the object to
            // an array, or cause an exception the attribute "_values" is
            // assigned as an array.
            result._values = result._values || [];
            result._values.push(hash_assign(null, keys, value));
        }

        return result;
    }

    // Key is an attribute name and can be assigned directly.
    if (!between) {
        result[key] = hash_assign(result[key], keys, value);
    }
    else {
        var string = between[1];
        // +var converts the variable into a number
        // better than parseInt because it doesn't truncate away trailing
        // letters and actually fails if whole thing is not a number
        var index = +string;

        // If the characters between the brackets is not a number it is an
        // attribute name and can be assigned directly.
        if (isNaN(index)) {
            result = result || {};
            result[string] = hash_assign(result[string], keys, value);
        }
        else {
            result = result || [];
            result[index] = hash_assign(result[index], keys, value);
        }
    }

    return result;
}

// Object/hash encoding serializer.
function hash_serializer(result, key, value) {
    var matches = key.match(brackets);

    // Has brackets? Use the recursive assignment function to walk the keys,
    // construct any missing objects in the result tree and make the assignment
    // at the end of the chain.
    if (matches) {
        var keys = parse_keys(key);
        hash_assign(result, keys, value);
    }
    else {
        // Non bracket notation can make assignments directly.
        var existing = result[key];

        // If the value has been assigned already (for instance when a radio and
        // a checkbox have the same name attribute) convert the previous value
        // into an array before pushing into it.
        //
        // NOTE: If this requirement were removed all hash creation and
        // assignment could go through `hash_assign`.
        if (existing) {
            if (!Array.isArray(existing)) {
                result[key] = [ existing ];
            }

            result[key].push(value);
        }
        else {
            result[key] = value;
        }
    }

    return result;
}

// urlform encoding serializer
function str_serialize(result, key, value) {
    // encode newlines as \r\n cause the html spec says so
    value = value.replace(/(\r)?\n/g, '\r\n');
    value = encodeURIComponent(value);

    // spaces should be '+' rather than '%20'.
    value = value.replace(/%20/g, '+');
    return result + (result ? '&' : '') + encodeURIComponent(key) + '=' + value;
}

module.exports = serialize;

},{}],3:[function(require,module,exports){
!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?n(exports):"function"==typeof define&&define.amd?define(["exports"],n):n(e.hyperapp={})}(this,function(e){"use strict";e.h=function(e,n){for(var t=[],r=[],o=arguments.length;2<o--;)t.push(arguments[o]);for(;t.length;){var l=t.pop();if(l&&l.pop)for(o=l.length;o--;)t.push(l[o]);else null!=l&&!0!==l&&!1!==l&&r.push(l)}return"function"==typeof e?e(n||{},r):{nodeName:e,attributes:n||{},children:r,key:n&&n.key}},e.app=function(e,n,t,r){var o,l=[].map,u=r&&r.children[0]||null,i=u&&function n(e){return{nodeName:e.nodeName.toLowerCase(),attributes:{},children:l.call(e.childNodes,function(e){return 3===e.nodeType?e.nodeValue:n(e)})}}(u),f=[],m=!0,a=v(e),c=function e(r,o,l){for(var n in l)"function"==typeof l[n]?function(e,t){l[e]=function(e){var n=t(e);return"function"==typeof n&&(n=n(h(r,a),l)),n&&n!==(o=h(r,a))&&!n.then&&d(a=p(r,v(o,n),a)),n}}(n,l[n]):e(r.concat(n),o[n]=v(o[n]),l[n]=v(l[n]));return l}([],a,v(n));return d(),c;function g(e){return"function"==typeof e?g(e(a,c)):null!=e?e:""}function s(){o=!o;var e=g(t);for(r&&!o&&(u=function e(n,t,r,o,l){if(o===r);else if(null==r||r.nodeName!==o.nodeName){var u=k(o,l);n.insertBefore(u,t),null!=r&&T(n,t,r),t=u}else if(null==r.nodeName)t.nodeValue=o;else{x(t,r.attributes,o.attributes,l=l||"svg"===o.nodeName);for(var i={},f={},a=[],c=r.children,s=o.children,d=0;d<c.length;d++){a[d]=t.childNodes[d];var v=N(c[d]);null!=v&&(i[v]=[a[d],c[d]])}for(var d=0,p=0;p<s.length;){var v=N(c[d]),h=N(s[p]=g(s[p]));if(f[v])d++;else if(null==h||h!==N(c[d+1]))if(null==h||m)null==v&&(e(t,a[d],c[d],s[p],l),p++),d++;else{var y=i[h]||[];v===h?(e(t,y[0],y[1],s[p],l),d++):y[0]?e(t,t.insertBefore(y[0],a[d]),y[1],s[p],l):e(t,a[d],null,s[p],l),f[h]=s[p],p++}else null==v&&T(t,a[d],c[d]),d++}for(;d<c.length;)null==N(c[d])&&T(t,a[d],c[d]),d++;for(var d in i)f[d]||T(t,i[d][0],i[d][1])}return t}(r,u,i,i=e)),m=!1;f.length;)f.pop()()}function d(){o||(o=!0,setTimeout(s))}function v(e,n){var t={};for(var r in e)t[r]=e[r];for(var r in n)t[r]=n[r];return t}function p(e,n,t){var r={};return e.length?(r[e[0]]=1<e.length?p(e.slice(1),n,t[e[0]]):n,v(t,r)):n}function h(e,n){for(var t=0;t<e.length;)n=n[e[t++]];return n}function N(e){return e?e.key:null}function y(e){return e.currentTarget.events[e.type](e)}function b(e,n,t,r,o){if("key"===n);else if("style"===n)if("string"==typeof t)e.style.cssText=t;else for(var l in"string"==typeof r&&(r=e.style.cssText=""),v(r,t)){var u=null==t||null==t[l]?"":t[l];"-"===l[0]?e.style.setProperty(l,u):e.style[l]=u}else"o"===n[0]&&"n"===n[1]?(n=n.slice(2),e.events?r||(r=e.events[n]):e.events={},(e.events[n]=t)?r||e.addEventListener(n,y):e.removeEventListener(n,y)):n in e&&"list"!==n&&"type"!==n&&"draggable"!==n&&"spellcheck"!==n&&"translate"!==n&&!o?e[n]=null==t?"":t:null!=t&&!1!==t&&e.setAttribute(n,t),null!=t&&!1!==t||e.removeAttribute(n)}function k(e,n){var t="string"==typeof e||"number"==typeof e?document.createTextNode(e):(n=n||"svg"===e.nodeName)?document.createElementNS("http://www.w3.org/2000/svg",e.nodeName):document.createElement(e.nodeName),r=e.attributes;if(r){r.oncreate&&f.push(function(){r.oncreate(t)});for(var o=0;o<e.children.length;o++)t.appendChild(k(e.children[o]=g(e.children[o]),n));for(var l in r)b(t,l,r[l],null,n)}return t}function x(e,n,t,r){for(var o in v(n,t))t[o]!==("value"===o||"checked"===o?e[o]:n[o])&&b(e,o,t[o],n[o],r);var l=m?t.oncreate:t.onupdate;l&&f.push(function(){l(e,n)})}function T(e,n,t){function r(){e.removeChild(function e(n,t){var r=t.attributes;if(r){for(var o=0;o<t.children.length;o++)e(n.childNodes[o],t.children[o]);r.ondestroy&&r.ondestroy(n)}return n}(n,t))}var o=t.attributes&&t.attributes.onremove;o?o(n,r):r()}}});

},{}],4:[function(require,module,exports){
module.exports = { fetchLinkedObjs: fetchLinkedObjs, fetchCopies: fetchCopies, fetchHomologs: fetchHomologs, fetchObj: fetchObj

  // Fetch all linked and sub-linked data from an upa
};function fetchLinkedObjs(upas, token) {
  upas = upas.map(function (upa) {
    return upa.replace(/\//g, ':');
  });
  var payload = { obj_keys: upas, link_limit: 20 };
  return aqlQuery(payload, token, { view: 'wsprov_fetch_linked_objects' });
}

// Fetch all copies and linked objects of those copies from an upa
function fetchCopies(upa, token, cb) {
  var payload = { obj_key: upa.replace(/\//g, ':'), copy_limit: 20 };
  return aqlQuery(payload, token, { view: 'wsprov_fetch_copies' });
}

// Use the sketch service to fetch homologs (only applicable to reads, assemblies, or annotations)
// For each homolog with a kbase_id, fetch the sub-links
function fetchHomologs(upa, token) {
  var url = window._env.sketchURL;
  var payload = {
    method: 'get_homologs',
    params: {
      ws_ref: upa.replace(/:/g, '/')
    }
  };
  var headers = {};
  if (window._env.authToken) {
    headers.Authorization = window._env.authToken;
  }
  return window.fetch(url, {
    method: 'POST',
    headers: headers,
    mode: 'cors',
    body: JSON.stringify(payload)
  }).then(function (resp) {
    return resp.json();
  }).then(function (json) {
    if (json && json.result && json.result.distances && json.result.distances.length) {
      return json.result.distances;
    }
  });
}

/*
// Fetch a random object to search on
// We find an object that has at least 1 copy, so the data is somewhat interesting
function fetchRandom () {
  // actions.update({ loadingUpa: true })
  function makeRequest (token) {
    const query = (`
      let ws_ids = @ws_ids
      for e in wsprov_copied_into
        sort rand()
        limit 1
        return e._from
    `)
    const payload = { query }
    return aqlQuery(payload, token)
  }
  const token = window._env.authToken
  makeRequest(token)
    .then(result => {
      const upa = result.replace('wsprov_object/', '').replace(/:/g, '/')
      console.log('random upa:', upa)
      // actions.update({ upa })
    })
    // .then(() => actions.update({ loadingUpa: false, error: null }))
    .catch(err => { console.error(err) })
}
*/

function fetchObj(upa, token) {
  // Fetch info about an object
  var payload = { obj_key: upa.replace(/\//g, ':') };
  return aqlQuery(payload, token, { view: 'wsprov_fetch_object' });
}

// Make a request to the relation engine api to do an ad-hoc admin query for prototyping
function aqlQuery(payload, token, params) {
  var apiUrl = window._env.relEngURL.replace(/\/$/, ''); // remove trailing slash
  var url = apiUrl + '/api/query_results/' + queryify(params);
  var headers = {};
  if (token) headers.Authorization = token;
  return window.fetch(url, {
    method: 'POST',
    headers: headers,
    mode: 'cors',
    body: JSON.stringify(payload)
  }).then(function (resp) {
    return resp.json();
  }).then(function (json) {
    if (json && json.results) return json.results[0];
    if (json && json.error) throw new Error(json.error);
  });
}

// Convert a js object into url querystring params
function queryify(params) {
  var items = [];
  for (var name in params) {
    items.push(encodeURIComponent(name) + '=' + encodeURIComponent(params[name]));
  }
  return '?' + items.join('&');
}
},{}],5:[function(require,module,exports){
var colorMapping = {
  AssemblyInput: '#F44336',
  Assembly: '#920D58',
  ChromatographyMatrix: '#E91E63',
  Collection: '#E91E63',
  ContigSet: '#3F51B5',
  DomainAlignment: '#000000',
  EstimateKResult: '#000000',
  ExpressionMatrix: '#2196F3',
  ExpressionSample: '#2196F3',
  ExpressionSeries: '#2196F3',
  FBA: '#673AB7',
  FBAModel: '#673AB7',
  FeatureClusters: '#AEEA00',
  FeatureSet: 'rgb(117, 152, 14)',
  FunctionalMatrix: '#000000',
  Genome: '#3F51B5',
  GenomeAnnotation: '#920D58',
  GenomeComparison: '#3F51B5',
  GenomeSet: '#3F51B5',
  Heatmap: '#795548',
  Media: '#795548',
  Metagenome: '#795548',
  Network: '#795548',
  Pangenome: '#795548',
  PhenotypeSet: '#795548',
  PhenotypeSimulationSet: '#795548',
  ProteomeComparison: '#795548',
  ReferenceAssembly: '#795548',
  SingleEndLibrary: '#795548',
  Taxon: '#920D58',
  TaxonomicMatrix: '#795548',
  Tree: '#795548'
};

module.exports = { colors: colorMapping };
},{}],6:[function(require,module,exports){
module.exports = showIf;

// A bit more readable ternary conditional for use in views
// Display the vnode if the boolean is truthy
// Can pass a plain vnode or a function that returns a vnode
function showIf(bool, vnode) {
  if (bool) {
    return typeof vnode === 'function' ? vnode() : vnode;
  }
  return '';
}
},{}]},{},[1]);
