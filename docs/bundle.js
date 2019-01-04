(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var _require = require('hyperapp'),
    h = _require.h,
    app = _require.app;

var state = {};
// Load cached form data from localStorage
try {
  state = JSON.parse(window.localStorage.getItem('state'));
  state.loading = false;
} catch (e) {
  window.localStorage.removeItem('state');
  state = {};
}

var actions = {
  update: function (state) {
    return function () {
      return state;
    };
  }

  // Fetch a random object to search on
  // We find an object that has at least 1 copy, so the data is somewhat interesting
};function fetchRando(state, actions) {
  actions.update({ loadingUpa: true });
  function makeRequest(token) {
    var query = '\n      for e in wsprov_copied_into\n        sort rand()\n        limit 1\n        return e._from\n    ';
    var payload = { query: query };
    return aqlQuery(payload, token);
  }
  makeRequest(state.authToken).then(function (result) {
    var upa = result.replace('wsprov_object/', '').replace(/:/g, '/');
    actions.update({ upa: upa });
  }).then(function () {
    return actions.update({ loadingUpa: false, error: null });
  }).catch(function (err) {
    actions.update({ obj: null, loadingUpa: false, error: String(err), upa: null });
  });
}

// Perform a full fetch on an object
// This performs serveral fetches on a couple services
function newSearch(state, actions) {
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
  });
  fetchObj(state.upa, state.authToken).then(function (results) {
    console.log('obj info results', results);
    if (results) {
      actions.update({ obj: results });
    } else {
      actions.update({ obj: { obj_name: 'Object ' + state.upa, upa: state.upa } });
    }
    return fetchLinkedObjs(state.upa, state.authToken);
  }).then(function (results) {
    console.log('linked results', results);
    actions.update({ links: results });
    return fetchCopies(state.upa, state.authToken);
  }).then(function (results) {
    console.log('copy results', results);
    actions.update({ copies: results, loading: false });
    return fetchHomologs(state.upa, state.authToken);
  }).then(function (results) {
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
    return fetchManyLinkedObjs(kbaseResults, state.authToken);
  }).then(function (results) {
    console.log('homology link results', results);
    actions.update({ similarLinked: results, searching: false });
  })
  // Always set an error and stop loading on an exception
  .catch(function (err) {
    return actions.update({ error: String(err), loading: false, searching: false });
  });
}

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
  if (obj.upa) {
    return { obj: dataview + obj.upa };
  }
  return {
    narrative: 'https://narrative.kbase.us/narrative/ws.' + obj.workspace_id + '.obj.1',
    obj: dataview + obj._key.replace(/:/g, '/'),
    owner: 'https://narrative.kbase.us/#people/' + obj.owner
  };
}

// Top-level view function
function view(state, actions) {
  window.localStorage.setItem('state', JSON.stringify(state));
  return h('div', { class: 'container px2 py3 max-width-3' }, [h('h1', { class: 'mt0 mb3' }, 'Relation Engine Object Viewer'), h('form', {
    onsubmit: function (ev) {
      ev.preventDefault();
      newSearch(state, actions);
    }
  }, [h('fieldset', { class: 'col col-4' }, [h('label', { class: 'block mb2 bold' }, 'KBase auth token (CI)'), h('input', {
    class: 'input p1',
    required: true,
    type: 'password',
    name: 'token',
    oninput: function (ev) {
      actions.update({ authToken: ev.currentTarget.value });
      return ev;
    },
    value: state.authToken
  })]), h('fieldset', { class: 'col col-6' }, [h('label', { class: 'block mb2 bold' }, 'Object Address (Prod)'), h('input', {
    placeholder: '1/2/3',
    class: 'input p1',
    required: true,
    type: 'text',
    name: 'upa',
    input: function (ev) {
      return actions.update({ upa: ev.currentTarget.value });
    },
    value: state.upa
  }), showIf(state.authToken && !state.loadingUpa, h('a', { class: 'btn right h5', onclick: function () {
      return fetchRando(state, actions);
    } }, 'Fetch random object ID')), showIf(state.loadingUpa, h('p', { class: 'inline-block pl2 m0' }, 'Loading...'))]), h('fieldset', { class: 'clearfix col-12 pt2' }, [h('button', { disabled: !state.authToken, class: 'btn', type: 'submit' }, 'Submit'), showIf(!state.authToken, h('p', { class: 'pl2 inline-block' }, 'Please enter an auth token first.'))])]), showIf(state.error, h('p', { class: 'error' }, state.error)), objInfo(state), linkedObjsSection(state, actions), copyObjsSection(state, actions), similarData(state, actions)]);
}

// Generic object info view
function objInfo(state) {
  var obj = state.obj;
  if (!obj) return '';
  var hrefs = objHrefs(obj);
  var title = h('h2', {}, [h('a', { href: hrefs.obj, target: '_blank', class: 'bold' }, [obj.obj_name, showIf(state.obj.ws_type, function () {
    return ' (' + typeName(state.obj.ws_type) + ')';
  })])]);
  var body = h('p', {}, [showIf(obj.narr_name, function () {
    return h('span', {}, ['In narrative ', h('a', { href: hrefs.narrative, target: '_blank' }, [obj.narr_name])]);
  }), showIf(obj.owner, function () {
    return h('span', {}, [' by ', h('a', { href: hrefs.owner, target: '_blank' }, [obj.owner])]);
  })]);
  return h('div', { class: 'mt2 pt1' }, [title, body]);
}

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
  if (state.loading) return h('p', {}, 'Loading related data...');
  if (!state.links || !state.links.links.length) return h('p', { class: 'muted' }, 'No linked data.');
  var links = state.links.links;
  var sublinks = state.links.sublinks;
  return h('div', { class: 'clearfix' }, [header('Linked data', links.length), filterTools(), h('div', {}, links.map(function (l) {
    return dataSection(sublinks, l, state, actions);
  }))]);
}

function copyObjsSection(state, actions) {
  if (state.loading) return '';
  if (!state.copies || !state.copies.copies.length) return h('p', { class: 'muted' }, 'No copies.');
  var copies = state.copies.copies;
  var sublinks = state.copies.sublinks;
  return h('div', { class: 'clearfix mt2' }, [header('Copies', copies.length), filterTools(), h('div', {}, copies.map(function (c) {
    return dataSection(sublinks, c, state, actions);
  }))]);
}

function similarData(state, actions) {
  if (state.searching) return h('p', {}, 'Searching for homologs...');
  if (!state.similar || !state.similar.length) return h('p', { class: 'muted' }, 'No similarity results.');
  return h('div', { class: 'clearfix mt2' }, [header('Similar data', state.similar.length), h('div', {}, state.similar.map(function (s) {
    return similarObjSection(s, state, actions);
  }))]);
}

function similarObjSection(entry, state, actions) {
  var readableNS = entry.namespaceid.replace('_', ' ');
  return h('div', { class: 'clearfix py1' }, [h('div', { class: 'h3 mb1' }, [h('p', { class: 'semi-muted mb1 my0 h4' }, [h('span', { class: 'bold' }, entry.dist), ' distance']), h('span', { class: 'mr1 circle left' }, ''), h('div', { class: 'clearfix left' }, [h('a', {
    onclick: function () {
      var upa = entry.kbase_id;
      actions.update({ upa: upa });
      state.upa = upa;
      newSearch(state, actions);
    }
  }, entry.sciname || entry.sourceid), h('span', { class: 'muted' }, [' (', readableNS, ')'])])])]);
}

// Section of parent data, with circle icon
function dataSection(sublinks, entry, state, actions) {
  var hrefs = objHrefs(entry);
  sublinks = sublinks.filter(function (l) {
    return l.parent_id === entry._id;
  });
  return h('div', { class: 'clearfix py1' }, [h('div', { class: 'h3 mb1 clearfix', style: { 'whiteSpace': 'nowrap' } }, [h('span', { class: 'mr1 circle inline-block' }, ''), h('div', { class: 'inline-block' }, [h('a', {
    onclick: function (ev) {
      var upa = entry._key.replace(/:/g, '/');
      actions.update({ upa: upa });
      newSearch(state, actions);
    }
  }, entry.obj_name), ' (', typeName(entry.ws_type), ') ', ' in ', h('a', { href: hrefs.narrative, target: '_blank' }, entry.narr_name)])]),
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
    style: { paddingLeft: '33px' }
  }, [h('div', {
    style: { position: 'absolute', top: '-32px', left: '7.5px' }
  }, [graphLine()]), h('span', { class: 'inline-block muted' }, [h('div', {}, [h('a', {
    onclick: function () {
      var upa = subentry._key.replace(/:/g, '/');
      actions.update({ upa: upa });
      state.upa = upa;
      newSearch(state, actions);
    }
  }, name), type, narrative])])]);
}

// Little svg line that represents sub-object links
function graphLine() {
  var style = 'stroke: #bbb; stroke-width: 2';
  var height = 40;
  var width = 22;
  return h('svg', {
    height: height + 1,
    width: width,
    class: 'inline-block align-top mr1'
  }, [h('line', { x1: 5, y1: 0, x2: 5, y2: height, style: style }), h('line', { x1: 4, y1: height, x2: width, y2: height, style: style })]);
}

// Filter results
function filterTools() {
  return h('div', { class: 'pb1' }, ['Filter by ', h('button', { class: 'btn mx2' }, 'Type'), h('button', { class: 'btn mr2' }, 'Owner'), h('div', { class: 'chkbx ml2' }, [h('div', { class: 'checkmark' }), h('input', { type: 'checkbox', id: 'chkbox1' }), h('label', { for: 'chkbox1' }, 'Public')]), h('div', { class: 'chkbx ml2' }, [h('div', { class: 'checkmark' }), h('input', { type: 'checkbox', id: 'chkbox2' }), h('label', { for: 'chkbox2' }, 'Private')])]);
}

// Section header
function header(text, total) {
  return h('div', { class: 'my2 py1 border-bottom' }, [h('h2', { class: 'inline-block m0 h3' }, text), h('span', { class: 'right inline-block' }, [total, ' total'])]);
}

// Render to the page
var container = document.querySelector('#hyperapp-container');
app(state, actions, view, container);

function fetchObj(upa, token) {
  // Fetch info about an object
  var query = '\n    let obj_id = CONCAT("wsprov_object/", @obj_key)\n    for obj in wsprov_object\n      filter obj._id == obj_id\n      return obj\n  ';
  var payload = { query: query, obj_key: upa.replace(/\//g, ':') };
  return aqlQuery(payload, token);
}

function fetchLinkedObjs(upa, token) {
  // Fetch all linked and sub-linked data from an upa
  var query = '\n    let obj_id = CONCAT("wsprov_object/", @obj_key)\n    let links = (\n      for obj in 1..1 any obj_id wsprov_links\n      filter obj\n      return obj\n    )\n    let sublinks = (\n      for obj in wsprov_object\n      filter obj in links\n      for obj1 in 1..100 any obj wsprov_links\n        filter obj1\n        limit 10\n        return distinct {parent_id: obj._id, obj: obj1}\n    )\n    return {links: links, sublinks: sublinks}\n  ';
  var payload = { query: query, obj_key: upa.replace(/\//g, ':') };
  return aqlQuery(payload, token);
}

function fetchManyLinkedObjs(upas, token) {
  var objIds = upas.map(function (u) {
    return 'wsprov_object/' + u.replace(/\//g, ':');
  });
  var query = '\n    let links = (\n      for obj in wsprov_object\n      filter obj._id in @objIds\n      for obj1 in 1..100 any obj wsprov_links\n        filter obj1\n        return {obj: obj1, parent_id: obj._id}\n    )\n    return {links: links}\n  ';
  var payload = { query: query, objIds: objIds };
  return aqlQuery(payload, token);
}

function fetchCopies(upa, token, cb) {
  // Fetch all copies and linked data of those copies from an upa
  var query = '\n    let obj_id = CONCAT("wsprov_object/", @obj_key)\n    let copies = (\n      for obj in 1..100 any obj_id wsprov_copied_into\n      filter obj\n      return obj\n    )\n    let sublinks = (\n      for obj in wsprov_object\n      filter obj in copies\n      for obj1 in 1..100 any obj wsprov_links\n        filter obj1\n        limit 10\n        return distinct {parent_id: obj._id, obj: obj1}\n    )\n    return {copies: copies, sublinks: sublinks}\n  ';
  var payload = { query: query, obj_key: upa.replace(/\//g, ':') };
  return aqlQuery(payload, token);
}

function fetchHomologs(upa, token) {
  // Use the sketch service to fetch homologs
  // (only applicable to reads, assemblies, or annotations)
  // For each homolog with a kbase_id, fetch the sub-links
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

function aqlQuery(payload, token, cb) {
  // Fetch the data
  return window.fetch('https://ci.kbase.us/services/relation_engine_api/api/query_results', {
    method: 'POST',
    headers: {
      // 'Content-Type': 'application/json',
      'Authorization': token
    },
    mode: 'cors',
    body: JSON.stringify(payload)
  }).then(function (resp) {
    return resp.json();
  }).then(function (json) {
    if (json && json.results && json.results.length) return json.results[0];
    if (json && json.error) throw new Error(json.error);
  });
}
},{"hyperapp":2}],2:[function(require,module,exports){
!function(e,n){"object"==typeof exports&&"undefined"!=typeof module?n(exports):"function"==typeof define&&define.amd?define(["exports"],n):n(e.hyperapp={})}(this,function(e){"use strict";e.h=function(e,n){for(var t=[],r=[],o=arguments.length;2<o--;)t.push(arguments[o]);for(;t.length;){var l=t.pop();if(l&&l.pop)for(o=l.length;o--;)t.push(l[o]);else null!=l&&!0!==l&&!1!==l&&r.push(l)}return"function"==typeof e?e(n||{},r):{nodeName:e,attributes:n||{},children:r,key:n&&n.key}},e.app=function(e,n,t,r){var o,l=[].map,u=r&&r.children[0]||null,i=u&&function n(e){return{nodeName:e.nodeName.toLowerCase(),attributes:{},children:l.call(e.childNodes,function(e){return 3===e.nodeType?e.nodeValue:n(e)})}}(u),f=[],m=!0,a=v(e),c=function e(r,o,l){for(var n in l)"function"==typeof l[n]?function(e,t){l[e]=function(e){var n=t(e);return"function"==typeof n&&(n=n(h(r,a),l)),n&&n!==(o=h(r,a))&&!n.then&&d(a=p(r,v(o,n),a)),n}}(n,l[n]):e(r.concat(n),o[n]=v(o[n]),l[n]=v(l[n]));return l}([],a,v(n));return d(),c;function g(e){return"function"==typeof e?g(e(a,c)):null!=e?e:""}function s(){o=!o;var e=g(t);for(r&&!o&&(u=function e(n,t,r,o,l){if(o===r);else if(null==r||r.nodeName!==o.nodeName){var u=k(o,l);n.insertBefore(u,t),null!=r&&T(n,t,r),t=u}else if(null==r.nodeName)t.nodeValue=o;else{x(t,r.attributes,o.attributes,l=l||"svg"===o.nodeName);for(var i={},f={},a=[],c=r.children,s=o.children,d=0;d<c.length;d++){a[d]=t.childNodes[d];var v=N(c[d]);null!=v&&(i[v]=[a[d],c[d]])}for(var d=0,p=0;p<s.length;){var v=N(c[d]),h=N(s[p]=g(s[p]));if(f[v])d++;else if(null==h||h!==N(c[d+1]))if(null==h||m)null==v&&(e(t,a[d],c[d],s[p],l),p++),d++;else{var y=i[h]||[];v===h?(e(t,y[0],y[1],s[p],l),d++):y[0]?e(t,t.insertBefore(y[0],a[d]),y[1],s[p],l):e(t,a[d],null,s[p],l),f[h]=s[p],p++}else null==v&&T(t,a[d],c[d]),d++}for(;d<c.length;)null==N(c[d])&&T(t,a[d],c[d]),d++;for(var d in i)f[d]||T(t,i[d][0],i[d][1])}return t}(r,u,i,i=e)),m=!1;f.length;)f.pop()()}function d(){o||(o=!0,setTimeout(s))}function v(e,n){var t={};for(var r in e)t[r]=e[r];for(var r in n)t[r]=n[r];return t}function p(e,n,t){var r={};return e.length?(r[e[0]]=1<e.length?p(e.slice(1),n,t[e[0]]):n,v(t,r)):n}function h(e,n){for(var t=0;t<e.length;)n=n[e[t++]];return n}function N(e){return e?e.key:null}function y(e){return e.currentTarget.events[e.type](e)}function b(e,n,t,r,o){if("key"===n);else if("style"===n)if("string"==typeof t)e.style.cssText=t;else for(var l in"string"==typeof r&&(r=e.style.cssText=""),v(r,t)){var u=null==t||null==t[l]?"":t[l];"-"===l[0]?e.style.setProperty(l,u):e.style[l]=u}else"o"===n[0]&&"n"===n[1]?(n=n.slice(2),e.events?r||(r=e.events[n]):e.events={},(e.events[n]=t)?r||e.addEventListener(n,y):e.removeEventListener(n,y)):n in e&&"list"!==n&&"type"!==n&&"draggable"!==n&&"spellcheck"!==n&&"translate"!==n&&!o?e[n]=null==t?"":t:null!=t&&!1!==t&&e.setAttribute(n,t),null!=t&&!1!==t||e.removeAttribute(n)}function k(e,n){var t="string"==typeof e||"number"==typeof e?document.createTextNode(e):(n=n||"svg"===e.nodeName)?document.createElementNS("http://www.w3.org/2000/svg",e.nodeName):document.createElement(e.nodeName),r=e.attributes;if(r){r.oncreate&&f.push(function(){r.oncreate(t)});for(var o=0;o<e.children.length;o++)t.appendChild(k(e.children[o]=g(e.children[o]),n));for(var l in r)b(t,l,r[l],null,n)}return t}function x(e,n,t,r){for(var o in v(n,t))t[o]!==("value"===o||"checked"===o?e[o]:n[o])&&b(e,o,t[o],n[o],r);var l=m?t.oncreate:t.onupdate;l&&f.push(function(){l(e,n)})}function T(e,n,t){function r(){e.removeChild(function e(n,t){var r=t.attributes;if(r){for(var o=0;o<t.children.length;o++)e(n.childNodes[o],t.children[o]);r.ondestroy&&r.ondestroy(n)}return n}(n,t))}var o=t.attributes&&t.attributes.onremove;o?o(n,r):r()}}});

},{}]},{},[1]);
