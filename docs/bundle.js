(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _require = require('hyperapp'),
    h = _require.h,
    app = _require.app;

// Get the url query string as an object


var query = window.location.search.slice(1).split('&').map(function (s) {
  return s.split('=');
}).map(function (_ref) {
  var _ref2 = _slicedToArray(_ref, 2),
      key = _ref2[0],
      val = _ref2[1];

  return [key, decodeURIComponent(val).replace(/['"]/g, '')];
}).reduce(function (obj, _ref3) {
  var _ref4 = _slicedToArray(_ref3, 2),
      key = _ref4[0],
      val = _ref4[1];

  obj[key] = val;return obj;
}, {});

var state = { navHistory: [], obj: {}

  // We just use actions.update for everything to keep it simple
};var actions = {
  followLink: function (_ref5) {
    var name = _ref5.name,
        upa = _ref5.upa;
    return function (state, actions) {
      var navHistory = state.navHistory || [];
      actions.setObject({ name: name, upa: upa });
      navHistory.push({ name: name, upa: state.upa });
      actions.update({ navHistory: navHistory });
    };
  },
  setObject: function (_ref6) {
    var name = _ref6.name,
        upa = _ref6.upa;
    return function (state, actions) {
      // window.history.pushState(null, '', '?upa=' + upa + '&name=' + name)
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
  fetchObj(state.upa, state.authToken)
    .then(results => {
      if (results) {
        actions.update({ obj: results })
      } else {
        if (!state.obj || !state.obj_name) {
          actions.update({ obj: { obj_name: 'Object ' + state.upa, upa: state.upa } })
        }
      }
      return fetchLinkedObjs(state.upa, state.authToken)
    })
    */
  fetchLinkedObjs(state.upa).then(function (results) {
    console.log('linked results', results);
    actions.update({ links: results, loadingLinks: false });
  }).catch(function (err) {
    return actions.update({ error: String(err), loadingLinks: false });
  });
  fetchCopies(state.upa).then(function (results) {
    console.log('copy results', results);
    actions.update({ copies: results, loadingCopies: false });
  }).catch(function (err) {
    return actions.update({ error: String(err), loadingCopies: false });
  });
  actions.update({ searching: true });
  fetchHomologs(state.upa).then(function (results) {
    if (!results || !results.length) return;
    console.log('homology results', results);
    actions.update({ similar: results });
    var kbaseResults = results.filter(function (r) {
      return 'kbase_id' in r;
    }).map(function (r) {
      return r.kbase_id.replace(/\//g, ':');
    });
    console.log('kbase results', kbaseResults);
    // TODO Find all linked objects for each results with a kbase_id
    return fetchManyLinkedObjs(kbaseResults);
  }).then(function (results) {
    console.log('homology link results', results);
    actions.update({ similarLinked: results, searching: false });
  }).catch(function (err) {
    return actions.update({ error: String(err), searching: false });
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

// Generate KBase linksf or an object
function objHrefs(obj) {
  var dataview = 'https://narrative.kbase.us/#dataview/';
  var hrefs = {};
  if (obj.upa) {
    hrefs.obj = dataview + obj.upa;
  } else if (obj._key) {
    hrefs.obj = dataview + obj._key.replace(/:/g, '/');
  }
  if (obj.workspace_id) {
    hrefs.narrative = 'https://narrative.kbase.us/narrative/ws.' + obj.workspace_id + '.obj.1';
  }
  if (obj.owner) {
    hrefs.owner = 'https://narrative.kbase.us/#people/' + obj.owner;
  }
  return hrefs;
}

// Top-level view function
function view(state, actions) {
  return h('div', { class: 'container p2 max-width-3' }, [
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
  */
  showIf(state.error, h('p', { class: 'error' }, state.error)), breadcrumbNav(state, actions),
  // backButton(state, actions),
  // objInfo(state, actions),
  linkedObjsSection(state, actions), copyObjsSection(state, actions), similarData(state, actions)]);
}

function breadcrumbNav(state, actions) {
  if (!state.navHistory || !state.navHistory.length) return '';
  var items = state.navHistory.map(function (item, idx) {
    return h('li', {
      class: 'inline-block breadcrumb'
    }, [h('a', {
      onclick: function () {
        console.log('going back..');
        var jumpTo = state.navHistory[idx];
        actions.update({ navHistory: state.navHistory.slice(0, idx + 1) });
        actions.setObject({ name: jumpTo.name, upa: jumpTo.upa });
      }
    }, item.name)]);
  }).slice(Math.max(state.navHistory.length - 3, 0)); // Only take the last 3 items
  return h('ul', {
    class: 'm0 p0',
    style: {
      overflow: 'hidden',
      whiteSpace: 'nowrap'
    }
  }, items);
}

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
function showIf(bool, vnode) {
  if (bool) {
    if (typeof vnode === 'function') return vnode();else return vnode;
  }
  return '';
}

// Section of linked objects -- "Linked data"
function linkedObjsSection(state, actions) {
  if (state.loadingLinks) {
    return h('p', { class: 'muted bold' }, 'Loading related data...');
  }
  if (!state.links || !state.links.links.length) {
    return h('p', { class: 'muted' }, 'There are no objects linked to this one.');
  }
  var links = state.links.links;
  var sublinks = state.links.sublinks;
  return h('div', { class: 'clearfix' }, [header('Linked data', links.length),
  // filterTools(),
  h('div', {}, links.map(function (l) {
    return dataSection(sublinks, l, state, actions);
  }))]);
}

// Copied objects section
function copyObjsSection(state, actions) {
  if (state.loadingCopies) {
    return h('p', { class: 'bold muted' }, 'Loading copies...');
  }
  if (!state.copies || !state.copies.copies.length) {
    return h('p', { class: 'muted' }, 'There are no copies of this object.');
  }
  var copies = state.copies.copies;
  var sublinks = state.copies.sublinks;
  return h('div', { class: 'clearfix mt2' }, [header('Copies', copies.length),
  // filterTools(),
  h('div', {}, copies.map(function (c) {
    return dataSection(sublinks, c, state, actions);
  }))]);
}

// Similar data section (search results from the assembly homology service)
function similarData(state, actions) {
  if (state.searching) {
    return h('p', {
      class: 'muted bold'
    }, 'Searching for similar data (can take up to 30 seconds)...');
  }
  if (!state.similar || !state.similar.length) return '';
  return h('div', { class: 'clearfix mt2' }, [header('Similar data', state.similar.length), h('div', {}, state.similar.map(function (s) {
    return similarObjSection(s, state, actions);
  }))]);
}

// Section for a single similar objects, with all sub-linked objects
function similarObjSection(entry, state, actions) {
  var distance = void 0;
  if (entry.dist === 0) {
    distance = [h('span', { class: 'bold' }, 'exact match')];
  } else {
    distance = [h('span', { class: 'bold' }, entry.dist), ' distance'];
  }
  var readableNS = entry.namespaceid.replace('_', ' ');
  var entryName = entry.sciname || entry.sourceid;
  return h('div', { class: 'clearfix py1' }, [h('div', { class: 'h3-5 mb1' }, [h('p', { class: 'semi-muted mb0-5 my0 h4' }, distance), h('span', { class: 'mr1 circle left' }, ''), h('div', { class: 'clearfix left' }, [h('a', {
    onclick: function () {
      var upa = entry.kbase_id;
      actions.followLink({ name: entryName, upa: upa });
    }
  }, entryName), h('span', { class: 'muted' }, [' (', readableNS, ')'])])])]);
}

// Section of parent data, with circle icon
function dataSection(sublinks, entry, state, actions) {
  var hrefs = objHrefs(entry);
  sublinks = sublinks.filter(function (l) {
    return l.parent_id === entry._id;
  });
  var entryName = entry.obj_name;
  return h('div', { class: 'clearfix py1' }, [h('div', { class: 'h3-5 mb1 clearfix', style: { 'whiteSpace': 'nowrap' } }, [h('span', { class: 'mr1 circle inline-block' }, ''), h('div', { class: 'inline-block text-ellipsis-100p' }, [h('a', {
    class: 'text-ellipsis-18rem',
    onclick: function (ev) {
      var upa = entry._key.replace(/:/g, '/');
      actions.followLink({ upa: upa, name: entryName });
    }
  }, entryName), ' (', typeName(entry.ws_type), ') ', ' in ', h('a', { href: hrefs.narrative, target: '_blank' }, entry.narr_name)])]),
  // Sub-link sections
  h('div', {}, [sublinks.map(function (subentry) {
    return subDataSection(subentry.obj, entry, state, actions);
  })])]);
}

// Section of sublinked objects with little graph lines
function subDataSection(subentry, entry, state, actions) {
  var hrefs = objHrefs(subentry);
  var name = subentry.obj_name;
  var type = '';
  if (subentry.ws_type) {
    type = ' (' + typeName(subentry.ws_type) + ')';
  }
  var narrative = '';
  if (subentry.narr_name && subentry.narr_name !== entry.narr_name) {
    narrative = h('span', {}, [' in ', h('a', { href: hrefs.narrative, target: '_blank' }, subentry.narr_name)]);
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
  }, [h('div', {
    style: { position: 'absolute', top: '-32px', left: '7.5px' }
  }, [graphLine()]), h('span', { class: 'inline-block muted text-ellipsis-100p' }, [h('a', {
    onclick: function () {
      var upa = subentry._key.replace(/:/g, '/');
      actions.followLink({ name: name, upa: upa });
    }
  }, name), type, narrative])]);
}

// Little svg line that represents sub-object links
function graphLine() {
  var style = 'stroke: #bbb; stroke-width: 2';
  var height = 43;
  var width = 22;
  return h('svg', {
    height: height + 1,
    width: width,
    class: 'inline-block align-top mr1'
  }, [h('line', { x1: 5, y1: 0, x2: 5, y2: height, style: style }), h('line', { x1: 4, y1: height, x2: width, y2: height, style: style })]);
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
function header(text, total) {
  return h('div', { class: 'my2 py1 border-bottom' }, [h('h2', { class: 'inline-block m0 h3' }, text), h('span', { class: 'right inline-block' }, [total, ' total'])]);
}

// Render to the page
var container = document.querySelector('#hyperapp-container');
var appActions = app(state, actions, view, container);

if (query.tok) {
  appActions.update({ authToken: query.tok });
}

if (query.upa) {
  var upa = query.upa.replace(/:/g, '/');
  var name = query.name || 'Object ' + upa;
  appActions.followLink({ name: name, upa: upa });
}

// window.history.pushState(null, '', '') // clear out the url query params

/*
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
*/

function fetchLinkedObjs(upa, token) {
  // Fetch all linked and sub-linked data from an upa
  /*
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
  */
  var payload = { key: upa.replace(/\//g, ':'), link_limit: 10, sublink_limit: 10 };
  return aqlQuery(payload, token, { view: 'wsprov_fetch_linked_objects' });
}

// Get 1st-level linked objects for every given object in a list
function fetchManyLinkedObjs(upas, token) {
  var objIds = upas.map(function (u) {
    return 'wsprov_object/' + u.replace(/\//g, ':');
  });
  /*
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
  */
  var payload = { obj_ids: objIds, link_limit: 10 };
  return aqlQuery(payload, token, { view: 'wsprov_fetch_multiple_linked_objects' });
}

// Fetch all copies and linked objects of those copies from an upa
function fetchCopies(upa, token, cb) {
  /*
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
  */
  var payload = { obj_key: upa.replace(/\//g, ':'), sublink_limit: 10 };
  return aqlQuery(payload, token, { view: 'wsprov_fetch_copies' });
}

// Use the sketch service to fetch homologs (only applicable to reads, assemblies, or annotations)
// For each homolog with a kbase_id, fetch the sub-links
function fetchHomologs(upa, token) {
  var url = 'https://kbase.us/dynserv/78a20dfaa6b39390ec2da8c02ccf8f1a7fc6198a.sketch-service';
  var payload = {
    method: 'get_homologs',
    params: [upa]
  };
  return window.fetch(url, {
    method: 'POST',
    headers: {},
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

// Fetch a random object to search on
// We find an object that has at least 1 copy, so the data is somewhat interesting
function fetchRandom() {
  // actions.update({ loadingUpa: true })
  function makeRequest(token) {
    var query = '\n      for e in wsprov_copied_into\n        sort rand()\n        limit 1\n        return e._from\n    ';
    var payload = { query: query };
    return aqlQuery(payload, token);
  }
  makeRequest(query.tok).then(function (result) {
    var upa = result.replace('wsprov_object/', '').replace(/:/g, '/');
    console.log('random upa:', upa);
    // actions.update({ upa })
  })
  // .then(() => actions.update({ loadingUpa: false, error: null }))
  .catch(function (err) {
    console.error(err);
  });
}
window.fetchRandom = fetchRandom;

// Make a request to the relation engine api to do an ad-hoc admin query for prototyping
function aqlQuery(payload, token, params) {
  var apiUrl = (query.api_url || 'https://ci.kbase.us/services/relation_engine_api').replace(/\/$/, ''); // remove trailing slash
  var url = apiUrl + '/api/query_results/' + queryify(params);
  console.log({ url: url });
  return window.fetch(url, {
    method: 'POST',
    /*
    headers: {
      // 'Content-Type': 'application/json',
      'Authorization': token
    },
    */
    mode: 'cors',
    body: JSON.stringify(payload)
  }).then(function (resp) {
    return resp.json();
  }).then(function (json) {
    if (json && json.results && json.results.length) return json.results[0];
    if (json && json.error) throw new Error(json.error);
  });
}

// Convert a js object into url querystring params
function queryify(params) {
  var items = [];
  for (var _name in params) {
    items.push(encodeURIComponent(_name) + '=' + encodeURIComponent(params[_name]));
  }
  return '?' + items.join('&');
}
},{"hyperapp":2}],2:[function(require,module,exports){
!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?n(exports):"function"==typeof define&&define.amd?define(["exports"],n):n(e.hyperapp={})}(this,function(e){"use strict";e.h=function(e,n){for(var t=[],r=[],o=arguments.length;2<o--;)t.push(arguments[o]);for(;t.length;){var l=t.pop();if(l&&l.pop)for(o=l.length;o--;)t.push(l[o]);else null!=l&&!0!==l&&!1!==l&&r.push(l)}return"function"==typeof e?e(n||{},r):{nodeName:e,attributes:n||{},children:r,key:n&&n.key}},e.app=function(e,n,t,r){var o,l=[].map,u=r&&r.children[0]||null,i=u&&function n(e){return{nodeName:e.nodeName.toLowerCase(),attributes:{},children:l.call(e.childNodes,function(e){return 3===e.nodeType?e.nodeValue:n(e)})}}(u),f=[],m=!0,a=v(e),c=function e(r,o,l){for(var n in l)"function"==typeof l[n]?function(e,t){l[e]=function(e){var n=t(e);return"function"==typeof n&&(n=n(h(r,a),l)),n&&n!==(o=h(r,a))&&!n.then&&d(a=p(r,v(o,n),a)),n}}(n,l[n]):e(r.concat(n),o[n]=v(o[n]),l[n]=v(l[n]));return l}([],a,v(n));return d(),c;function g(e){return"function"==typeof e?g(e(a,c)):null!=e?e:""}function s(){o=!o;var e=g(t);for(r&&!o&&(u=function e(n,t,r,o,l){if(o===r);else if(null==r||r.nodeName!==o.nodeName){var u=k(o,l);n.insertBefore(u,t),null!=r&&T(n,t,r),t=u}else if(null==r.nodeName)t.nodeValue=o;else{x(t,r.attributes,o.attributes,l=l||"svg"===o.nodeName);for(var i={},f={},a=[],c=r.children,s=o.children,d=0;d<c.length;d++){a[d]=t.childNodes[d];var v=N(c[d]);null!=v&&(i[v]=[a[d],c[d]])}for(var d=0,p=0;p<s.length;){var v=N(c[d]),h=N(s[p]=g(s[p]));if(f[v])d++;else if(null==h||h!==N(c[d+1]))if(null==h||m)null==v&&(e(t,a[d],c[d],s[p],l),p++),d++;else{var y=i[h]||[];v===h?(e(t,y[0],y[1],s[p],l),d++):y[0]?e(t,t.insertBefore(y[0],a[d]),y[1],s[p],l):e(t,a[d],null,s[p],l),f[h]=s[p],p++}else null==v&&T(t,a[d],c[d]),d++}for(;d<c.length;)null==N(c[d])&&T(t,a[d],c[d]),d++;for(var d in i)f[d]||T(t,i[d][0],i[d][1])}return t}(r,u,i,i=e)),m=!1;f.length;)f.pop()()}function d(){o||(o=!0,setTimeout(s))}function v(e,n){var t={};for(var r in e)t[r]=e[r];for(var r in n)t[r]=n[r];return t}function p(e,n,t){var r={};return e.length?(r[e[0]]=1<e.length?p(e.slice(1),n,t[e[0]]):n,v(t,r)):n}function h(e,n){for(var t=0;t<e.length;)n=n[e[t++]];return n}function N(e){return e?e.key:null}function y(e){return e.currentTarget.events[e.type](e)}function b(e,n,t,r,o){if("key"===n);else if("style"===n)if("string"==typeof t)e.style.cssText=t;else for(var l in"string"==typeof r&&(r=e.style.cssText=""),v(r,t)){var u=null==t||null==t[l]?"":t[l];"-"===l[0]?e.style.setProperty(l,u):e.style[l]=u}else"o"===n[0]&&"n"===n[1]?(n=n.slice(2),e.events?r||(r=e.events[n]):e.events={},(e.events[n]=t)?r||e.addEventListener(n,y):e.removeEventListener(n,y)):n in e&&"list"!==n&&"type"!==n&&"draggable"!==n&&"spellcheck"!==n&&"translate"!==n&&!o?e[n]=null==t?"":t:null!=t&&!1!==t&&e.setAttribute(n,t),null!=t&&!1!==t||e.removeAttribute(n)}function k(e,n){var t="string"==typeof e||"number"==typeof e?document.createTextNode(e):(n=n||"svg"===e.nodeName)?document.createElementNS("http://www.w3.org/2000/svg",e.nodeName):document.createElement(e.nodeName),r=e.attributes;if(r){r.oncreate&&f.push(function(){r.oncreate(t)});for(var o=0;o<e.children.length;o++)t.appendChild(k(e.children[o]=g(e.children[o]),n));for(var l in r)b(t,l,r[l],null,n)}return t}function x(e,n,t,r){for(var o in v(n,t))t[o]!==("value"===o||"checked"===o?e[o]:n[o])&&b(e,o,t[o],n[o],r);var l=m?t.oncreate:t.onupdate;l&&f.push(function(){l(e,n)})}function T(e,n,t){function r(){e.removeChild(function e(n,t){var r=t.attributes;if(r){for(var o=0;o<t.children.length;o++)e(n.childNodes[o],t.children[o]);r.ondestroy&&r.ondestroy(n)}return n}(n,t))}var o=t.attributes&&t.attributes.onremove;o?o(n,r):r()}}});

},{}]},{},[1]);
