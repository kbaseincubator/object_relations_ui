(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var _require = require('hyperapp'),
    h = _require.h,
    app = _require.app;

var serialize = require('form-serialize');

var state = {};
// Load cached form data
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
      console.log('new state', state);
      return state;
    };
  }

  // Fetch a random object to search on
};function fetchRando(state, actions) {
  actions.update({ loading: true });
  fetchRandomObj(state.token).then(function (result) {
    var upa = result.replace('wsprov_object/', '').replace(/:/g, '/');
    actions.update({ upa: upa });
  }).then(function () {
    return actions.update({ loading: false, error: null });
  }).catch(function (err) {
    actions.update({ obj: null, loading: false, error: String(err), upa: null });
  });
}

// Perform a full fetch on an object
function submitForm(ev, actions) {
  ev.preventDefault();
  actions.update({
    obj: null,
    similarLinked: null,
    similar: null,
    copies: null,
    links: null,
    error: null,
    loading: true
  });
  var data = serialize(ev.currentTarget, { hash: true });
  actions.update(data);
  fetchObj(data.upa, data.token).then(function (results) {
    console.log('obj info results', results);
    actions.update({ obj: results });
    return fetchLinkedObjs(data.upa, data.token);
  }).then(function (results) {
    console.log('linked results', results);
    actions.update({ links: results });
    return fetchCopies(data.upa, data.token);
  }).then(function (results) {
    console.log('copy results', results);
    actions.update({ copies: results });
    return fetchHomologs(data.upa, data.token);
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
    return fetchManyLinkedObjs(kbaseResults, data.token);
  }).then(function (results) {
    console.log('homology link results', results);
    actions.update({ similarLinked: results });
  })
  // Stop loading
  .then(function () {
    return actions.update({ loading: false });
  }).catch(function (err) {
    return actions.update({ error: String(err) });
  });
  // fetchProvenance(data.upa, data.token, actions)
  // fetchHomologs(data.upa, data.token, actions)
}

// Convert something like "Module.Type-5.0" into just "Type"
// Returns the input if we cannot match the format
function typeName(typeStr) {
  var matches = typeStr.match(/^.+\.(.+)-.+$/);
  if (!matches) return typeStr;
  return matches[1];
}

function objHrefs(obj) {
  return {
    narrative: 'https://narrative.kbase.us/narrative/ws.' + obj.workspace_id + '.obj.1',
    obj: 'https://narrative.kbase.us/#dataview/' + obj._key.replace(/:/g, '/'),
    owner: 'https://narrative.kbase.us/#people/' + obj.owner
  };
}

function objInfo(obj) {
  if (!obj) return '';
  return h('div', { class: 'mt2 pt1' }, [h('h2', {}, [h('a', {
    href: objHrefs(obj).obj,
    target: '_blank',
    class: 'bold'
  }, [obj.obj_name, ' (', typeName(obj.ws_type), ')'])]), h('p', {}, ['In narrative ', h('a', {
    href: 'https://narrative.kbase.us/narrative/ws.' + obj.workspace_id + '.obj.1',
    target: '_blank'
  }, [obj.narr_name]), ' by ', h('a', {
    href: 'https://narrative.kbase.us/#people/' + obj.owner,
    target: '_blank'
  }, [obj.owner])])]);
}

// Top-level view function
function view(state, actions) {
  window.localStorage.setItem('state', JSON.stringify(state));
  var errorMsg = state.error ? h('p', {}, state.error) : '';
  return h('div', { class: 'container px2 py3 max-width-3' }, [h('h1', { class: 'mt0 mb3' }, 'Relation Engine Object Viewer'), h('form', { onsubmit: function (ev) {
      return submitForm(ev, actions);
    } }, [h('fieldset', { class: 'col col-4' }, [h('label', { class: 'block mb2 bold' }, 'KBase auth token (CI)'), h('input', {
    class: 'input p1', required: true, type: 'password', name: 'token', value: state.token
  })]), h('fieldset', { class: 'col col-6' }, [h('label', { class: 'block mb2 bold' }, 'Object Address (Prod)'), h('input', {
    placeholder: '30462/10/1',
    class: 'input p1',
    required: true,
    type: 'text',
    name: 'upa',
    value: state.upa
  }), h('a', { class: 'btn right h5', onclick: function () {
      return fetchRando(state, actions);
    } }, 'Fetch random object ID')]), h('fieldset', { class: 'clearfix col-12 pt2' }, [h('button', { disabled: state.loading, class: 'btn', type: 'submit' }, state.loading ? 'Loading' : 'Submit')])]), errorMsg, h('p', {}, 'Note that the filters do not work yet. Homology search takes ~30 seconds on the first run.'), objInfo(state.obj), linkedObjsSection(state), copyObjsSection(state), similarObjsSection(state)]);
}

function linkedObjsSection(state) {
  if (!state.links || !state.links.links.length) return '';
  var links = state.links.links;
  var sublinks = state.links.sublinks;
  return h('div', { class: 'clearfix' }, [header('Linked data', links.length), filterTools(), h('div', {}, links.map(function (l) {
    return dataSection(sublinks, l);
  }))]);
}

function copyObjsSection(state) {
  if (!state.copies || !state.copies.copies.length) return '';
  var copies = state.copies.copies;
  var sublinks = state.copies.sublinks;
  return h('div', { class: 'clearfix mt2' }, [header('Copies', copies.length), filterTools(), h('div', {}, copies.map(function (c) {
    return dataSection(sublinks, c);
  }))]);
}

function similarObjsSection(state) {
  if (!state.similar || !state.similar.length) return '';
  return h('div', { class: 'clearfix mt2' }, [header('Similar data', state.similar.length), h('div', {}, state.similar.map(similarObjSection))]);
}

function similarObjSection(entry) {
  // TODO href is ncbi or kbase based on kbase_id
  var href = '#';
  if (entry.kbase_id) {
    href = 'https://narrative.kbase.us/#dataview/' + entry.kbase_id;
  } else {
    href = 'https://www.ncbi.nlm.nih.gov/assembly/' + entry.sourceid;
  }
  return h('div', { class: 'clearfix py1' }, [h('div', { class: 'h3 mb1' }, [h('p', { class: 'semi-muted mb1 my0 h4' }, [h('span', { class: 'bold' }, entry.dist), ' distance']), h('span', { class: 'mr1 circle left' }, ''), h('div', { class: 'clearfix left' }, [h('a', { href: href, target: '_blank' }, entry.sciname)])])]);
}

// Section of parent data, with circle icon
function dataSection(sublinks, entry) {
  var hrefs = objHrefs(entry);
  sublinks = sublinks.filter(function (l) {
    return l.parent_id === entry._id;
  });
  console.log('sublinks', sublinks);
  return h('div', { class: 'clearfix py1' }, [h('div', { class: 'h3 mb1 clearfix' }, [h('span', { class: 'mr1 circle left' }, ''), h('div', { class: 'clearfix left' }, [h('a', { href: hrefs.obj, target: '_blank' }, entry.obj_name), ' (', typeName(entry.ws_type), ') ']), h('div', { class: 'clearfix left h4 mt1' }, [' In ', h('a', { href: hrefs.narrative, target: '_blank' }, entry.narr_name), ' by ', h('a', { href: hrefs.owner, target: '_blank' }, entry.owner)])]),
  // Sub-link sections
  h('div', { class: 'clearfix' }, [sublinks.map(function (subentry) {
    return subDataSection(subentry.obj, entry);
  })])]);
}

// Section of sublinked objects with little graph lines
function subDataSection(subentry, entry) {
  var hrefs = objHrefs(subentry);
  var name = subentry.obj_name;
  if (subentry.ws_type) {
    name += ' (' + typeName(subentry.ws_type) + ')';
  }
  var narrative = '';
  if (subentry.narr_name && subentry.narr_name !== entry.narr_name) {
    narrative = h('span', {}, ['In ', h('a', { href: hrefs.narrative, target: '_blank' }, subentry.narr_name)]);
  }
  var author = '';
  if (subentry.owner && subentry.owner !== entry.owner) {
    author = h('span', {}, [' by ', h('a', { href: hrefs.owner, target: '_blank' }, subentry.owner)]);
  }
  return h('div', { class: 'pl1 clearfix mb1' }, [graphLine(), h('span', { class: 'inline-block muted' }, [h('div', {}, [h('a', { href: hrefs.obj, target: '_blank' }, name)]), h('div', {}, [narrative, author])])]);
}

// Little svg line that represents sub-object links
function graphLine() {
  var style = 'stroke: #bbb; stroke-width: 2';
  var height = 22;
  return h('svg', {
    height: height + 1,
    width: 25,
    class: 'inline-block align-top mr1',
    style: 'position: relative; top: -10px'
  }, [h('line', { x1: 5, y1: 0, x2: 5, y2: height, style: style }), h('line', { x1: 4, y1: height, x2: 25, y2: height, style: style })]);
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
  console.log('???');
  console.log(objIds);
  var query = '\n    let links = (\n      for obj in wsprov_object\n      filter obj._id in @objIds\n      for obj1 in 1..100 any obj wsprov_links\n        filter obj1\n        return {obj: obj1, parent_id: obj._id}\n    )\n    return {links: links}\n  ';
  console.log(query);
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
    console.log('homology json', json);
    if (json && json.result && json.result.distances && json.result.distances.length) {
      return json.result.distances;
    }
  });
}

function fetchRandomObj(token) {
  var query = '\n    for e in wsprov_copied_into\n      sort rand()\n      limit 1\n      return e._from\n  ';
  var payload = { query: query };
  return aqlQuery(payload, token);
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
},{"form-serialize":2,"hyperapp":3}],2:[function(require,module,exports){
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

},{}]},{},[1]);
