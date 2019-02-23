(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Use all useful snabbdom modules
var patch = require('snabbdom').init([require('snabbdom/modules/props').default, require('snabbdom/modules/style').default, require('snabbdom/modules/class').default, require('snabbdom/modules/eventlisteners').default, require('snabbdom/modules/dataset').default, require('snabbdom/modules/attributes').default]);
var h = require('snabbdom/h').default;

module.exports = Component;

// Create simple UI components. Docs are in ../components.md
function Component(obj) {
  var view = obj.view;
  obj._viewArgs = [];
  obj._vnode = patch(document.createElement('div'), h('div'));
  obj._render = function () {
    var newVnode = patch(obj._vnode, view.apply(obj, obj._viewArgs));
    // Do some efficient subtree patching
    for (var prop in newVnode) {
      obj._vnode[prop] = newVnode[prop];
    }
    return obj._vnode;
  };
  obj.view = function () {
    obj._viewArgs = arguments;
    return obj._render();
  };
  return obj;
}
},{"snabbdom":18,"snabbdom/h":9,"snabbdom/modules/attributes":12,"snabbdom/modules/class":13,"snabbdom/modules/dataset":14,"snabbdom/modules/eventlisteners":15,"snabbdom/modules/props":16,"snabbdom/modules/style":17}],2:[function(require,module,exports){
var Component = require('./Component.js');
var h = require('snabbdom/h').default;

// utils

var _require = require('../utils/apiClients'),
    fetchReferences = _require.fetchReferences;

var toObjKey = require('../utils/toObjKey');
var typeName = require('../utils/typeName');
var formatDate = require('../utils/formatDate');
var objHrefs = require('../utils/objHrefs');

// views
var definition = require('./views/definition');

module.exports = { HomologDetails: HomologDetails

  // This component appears when a user expands a homolog result to view further details
  // `data` is one row in the results fetched in HomologTable.data
};function HomologDetails(data) {
  return Component({
    references: {
      fetched: false,
      data: [],
      currentPage: 0,
      pageSize: 10,
      loading: false
    },
    // Fetch referencing objects
    fetchReferences: function (result) {
      var _this = this;

      if (this.references.fetched) return;
      this.references.loading = true;
      var key = toObjKey(this.data.kbase_id);
      fetchReferences(key).then(function (resp) {
        if (resp && resp.results && resp.results.length) {
          _this.references.data = resp.results;
        } else {
          throw new Error(resp);
        }
      }).catch(function (err) {
        console.error(err);
      }).finally(function () {
        _this.references.loading = false;
        _this.references.fetched = true;
        _this._render();
      });
    },

    data: data,
    view: view
  });
}

function view() {
  var details = this;
  var href = window._env.kbaseRoot + '/#dataview/' + details.data.kbase_id;
  return h('div.p1', [definition('Assembly page', details.data.sciname || details.data.sourceid, href), refTable(details)]);
}

function refTable(details) {
  if (details.references.loading) {
    return h('p.p1.muted', 'Loading references...');
  }
  if (!details.references.data || !details.references.data.length) {
    return h('p.p1.muted', 'No further references found for this result.');
  }
  return h('div.p1', [h('h3.h3-5.my1', 'Referencing Objects'), h('table.table-lined.table-lined-gray', [h('thead', [h('tr', [h('th', 'Type'), h('th', 'Name'), h('th', 'Creator'), h('th', 'Date')])]), h('tbody', details.references.data.map(function (r) {
    return refRow(details, r);
  }))])]);
}

function refRow(details, ref) {
  var hrefs = objHrefs(ref);
  return h('tr', {
    key: ref._key
  }, [h('td', h('span.bold', typeName(ref.ws_type))), h('td', [h('a', {
    props: {
      href: hrefs.obj,
      target: '_blank'
    }
  }, [ref.obj_name])]), h('td', ref.owner), h('td', formatDate(ref.save_date))]);
}
},{"../utils/apiClients":21,"../utils/formatDate":22,"../utils/objHrefs":24,"../utils/toObjKey":27,"../utils/typeName":29,"./Component.js":1,"./views/definition":6,"snabbdom/h":9}],3:[function(require,module,exports){
var Component = require('./Component.js');
var h = require('snabbdom/h').default;

// components

var _require = require('./HomologDetails'),
    HomologDetails = _require.HomologDetails;

// utils


var _require2 = require('../utils/apiClients'),
    fetchHomologs = _require2.fetchHomologs,
    fetchKnowledgeScores = _require2.fetchKnowledgeScores;

var showIf = require('../utils/showIf');
var toObjKey = require('../utils/toObjKey');
var sortBy = require('../utils/sortBy');

module.exports = { HomologTable: HomologTable };

function HomologTable() {
  return Component({
    upa: null,
    data: [],
    currentPage: 1,
    pageSize: 30,
    sortable: { 'Knowledge Score': true },
    sortCol: 'Distance',
    sortDir: 'asc',
    loading: false,
    hasMore: false,
    // Functions for sorting each column in the results
    // see the sortBy function below, and the docs for Array.sort on MDN
    sorters: {
      'Distance': function (x, y) {
        return sortBy(Number(x.dist), Number(y.dist));
      },
      'Name': function (x, y) {
        return sortBy(x.sciname || x.sourceid, y.sciname || y.sourceid);
      },
      'Knowledge Score': function (x, y) {
        var scorex = isNaN(x.knowledge_score) ? 0 : Number(x.knowledge_score);
        var scorey = isNaN(y.knowledge_score) ? 0 : Number(y.knowledge_score);
        return sortBy(scorex, scorey);
      },
      'Source': function (x, y) {
        return sortBy(x.source, y.source);
      }
    },
    // Sort the results by a column
    sortByColumn: function (colName) {
      var alreadySorting = this.sortCol === colName;
      if (alreadySorting && this.sortDir === 'asc') {
        this.sortDir = 'desc';
      } else {
        this.sortDir = 'asc';
        this.sortCol = colName;
      }
      if (this.sortCol) {
        var sorter = this.sorters[colName];
        if (this.sortDir === 'desc') sorter = reverse(sorter);
        this.data.sort(sorter);
      }
      this._render();
    },

    // Advance the page (simply show more data in the dom, no ajax)
    nextPage: function () {
      if (!this.hasMore) return;
      this.currentPage += 1;
      this.hasMore = this.currentPage * this.pageSize < this.data.length;
      this._render();
    },

    // Fetch assembly homology results for a given reads, assembly, or genome object
    fetch: function (upa) {
      var _this = this;

      this.upa = upa.replace(/:/g, '/');
      this.loading = true;
      fetchHomologs(this.upa).then(function (resp) {
        _this.loading = false;
        _this.currentPage = 1;
        if (resp && resp.length) {
          _this.data = resp;
          _this.hasMore = _this.data.length > _this.pageSize;
        } else {
          _this.data = [];
          _this.hasMore = false;
        }
        return _this.data;
      }).then(function (data) {
        if (data && data.length) {
          // Initialize and assign a HomologDetails component for each result
          data = data.map(function (d) {
            d.details = HomologDetails(d);
            return d;
          });
          // Get an array of all the KBase workspace IDs for each result
          var ids = data.map(function (d) {
            return d.kbase_id;
          }).filter(Boolean).map(toObjKey).map(function (key) {
            return 'wsprov_object/' + key;
          });
          return fetchKnowledgeScores(ids);
        } else {
          return [];
        }
      })
      // Fetch knowledge scores from arango for each result
      // Assign the scores into each result object
      .then(function (resp) {
        if (resp && resp.results && resp.results.length) {
          resp.results.forEach(function (result, idx) {
            var score = Number(result.knowledge_score);
            var resultKey = result.key;
            _this.data.filter(function (d) {
              return toObjKey(d.kbase_id) === resultKey;
            }).forEach(function (d) {
              d.knowledge_score = score;
            });
          });
        }
      }).catch(function (err) {
        console.error(err);
      }).finally(function () {
        _this.loading = false;
        _this._render();
      });
    },

    view: view
  });
}

function view() {
  var _this2 = this;

  var table = this;
  if (table.loading) {
    return h('p.muted', 'Loading homologs...');
  }
  if (!table.data || !table.data.length) {
    return h('div', '');
  }
  var displayedCount = table.currentPage * table.pageSize;
  var nCols = 5; // number of columns in the table
  var tableRows = [];
  for (var i = 0; i < displayedCount && i < table.data.length; ++i) {
    tableRows.push(resultRow(table, table.data[i]));
    tableRows.push(resultRowDetails(table, table.data[i], nCols));
  }
  return h('div', [h('h2.mt3', 'Similar Assemblies'), h('table.table-lined', [h('thead', [h('tr', [h('th.sticky', ''), // empty table header for plus/minus expand icon
  th(table, 'Distance'), th(table, 'Name'), th(table, 'Knowledge Score'), th(table, 'Source')])]), h('tbody', tableRows)]), showIf(!table.hasMore, function () {
    return h('p.muted', 'No more results.');
  }), showIf(table.hasMore, function () {
    var remaining = table.data.length - _this2.currentPage * _this2.pageSize;
    return h('div', [h('button.btn.mt2', { on: { click: function () {
          return table.nextPage();
        } } }, ['Load more ']), h('span.muted.inline-block.ml1', [remaining, ' left'])]);
  })]);
}

function resultRow(table, result) {
  var dist = result.dist,
      namespaceid = result.namespaceid,
      sciname = result.sciname,
      sourceid = result.sourceid;

  return h('tr.expandable', {
    key: sourceid,
    class: { expanded: result.expanded },
    on: {
      click: function () {
        result.expanded = !result.expanded;
        result.details.fetchReferences();
        table._render();
      }
    }
  }, [h('td', [h('span.expand-icon', result.expanded ? '−' : '+')]), h('td.bold', [dist]), h('td', [sciname || sourceid]), h('td', [isNaN(result.knowledge_score) ? '' : result.knowledge_score]), h('td', [namespaceid.replace(/_/g, ' ')])]);
}

function resultRowDetails(table, result, nCols) {
  return h('tr.expandable-sibling', {
    key: result.sourceid + '-details',
    class: { 'expanded-sibling': result.expanded }
  }, [h('td', { props: { colSpan: nCols } }, [result.details.view()])]);
}

function th(table, txt) {
  var isSorting = table.sortCol === txt;
  return h('th.sortable.sticky', {
    class: { sorting: isSorting },
    on: {
      click: function () {
        table.sortByColumn(txt);
      }
    }
  }, [h('span', [txt]), showIf(isSorting, function () {
    return h('span.arrow.inline-block.ml1', {
      class: {
        'arrow-down': table.sortDir === 'asc',
        'arrow-up': table.sortDir === 'desc'
      }
    });
  })]);
}

function reverse(fn) {
  return function (x, y) {
    var result = fn(x, y);
    return -result;
  };
}
},{"../utils/apiClients":21,"../utils/showIf":25,"../utils/sortBy":26,"../utils/toObjKey":27,"./Component.js":1,"./HomologDetails":2,"snabbdom/h":9}],4:[function(require,module,exports){
var Component = require('./Component.js');
var h = require('snabbdom/h').default;

// views
var definition = require('./views/definition');

// utils

var _require = require('../utils/apiClients'),
    fetchLinkedObjs = _require.fetchLinkedObjs;

var objHrefs = require('../utils/objHrefs');
var formatDate = require('../utils/formatDate');
var showIf = require('../utils/showIf');
var typeName = require('../utils/typeName');

module.exports = { LinkedDataTable: LinkedDataTable };

function LinkedDataTable(objKey, type, count) {
  return Component({
    type: type,
    totalCount: count,
    obj_key: objKey,
    data: [],
    page: 0,
    limit: 20,
    loading: false,
    loadingMore: false,
    fetchInitial: function () {
      var _this = this;

      // Fetch the initial set of linked data
      this.loading = true;
      this.page = 0;
      this._render();
      fetchLinkedObjs(objKey, { type: type, offset: 0, limit: this.limit }).then(function (resp) {
        _this.loading = false;
        _this.data = null;
        _this.hasMore = false;
        if (resp.results && resp.results.length) {
          _this.data = resp.results[0];
          if (_this.data.length < _this.totalCount) {
            _this.hasMore = true;
          }
        } else if (resp.error) {
          console.error(resp.error);
        }
        _this._render();
      }).catch(function (err) {
        console.error(err);
        _this.loading = false;
        _this._render();
      });
    },
    fetchNext: function () {
      var _this2 = this;

      // Fetch the next page of results using an offset
      this.page += 1;
      this.loadingMore = true;
      this._render();
      var offset = this.page * this.limit;
      fetchLinkedObjs(this.obj_key, {
        type: this.type,
        offset: offset,
        limit: this.limit
      }).then(function (resp) {
        if (resp.results) {
          if (resp.results.length && resp.results[0].length) {
            _this2.data = _this2.data.concat(resp.results[0]);
          } else {
            _this2.hasMore = false;
          }
          if (_this2.data.length >= _this2.totalCount) {
            _this2.hasMore = false;
          }
        }
        if (resp.error) {
          console.error(resp.error);
        }
        _this2.loadingMore = false;
        _this2._render();
      }).catch(function (err) {
        console.error(err);
        _this2.loadingMore = false;
        _this2._render();
      });
    },

    view: view
  });
}

function view() {
  var _this3 = this;

  if (this.loading) {
    return h('p.muted', 'Loading...');
  }
  if (!this.data || !this.data.length) {
    return h('p.muted', 'No linked data');
  }
  var tableRows = [];
  var nCols = 5;

  var _loop = function (i) {
    var _data$i = _this3.data[i],
        path = _data$i.path,
        vertex = _data$i.vertex,
        expanded = _data$i.expanded;

    var formattedPath = path.vertices.map(function (v) {
      return typeName(v.ws_type);
    });
    formattedPath[0] += ' (this)';
    formattedPath = formattedPath.join(' 🡒 ');
    var dataRow = h('tr.expandable', {
      class: { expanded: expanded },
      key: vertex._key,
      on: {
        click: function () {
          _this3.data[i].expanded = !_this3.data[i].expanded;
          _this3._render();
        }
      }
    }, [h('td', [h('span.expand-icon', expanded ? '−' : '+')]), h('td', [vertex.obj_name
    // h('a', { props: { href: hrefs.obj } }, vertex.obj_name)
    ]), h('td', formatDate(vertex.save_date)), h('td', [vertex.owner
    // h('a', { props: { href: hrefs.owner } }, vertex.owner)
    ]), h('td', [vertex.narr_name
    // h('a', { props: { href: hrefs.narrative } }, vertex.narr_name)
    ])]);
    var hrefs = objHrefs(vertex);
    var detailsRow = h('tr.expandable-sibling', {
      key: vertex._key + '-details',
      class: { 'expanded-sibling': expanded }
    }, [h('td', { props: { colSpan: nCols } }, [h('div.p1', {
      style: {
        overflow: 'auto',
        whiteSpace: 'normal'
      }
    }, [definition('Object', vertex.obj_name, hrefs.obj), definition('Save date', formatDate(vertex.save_date)), definition('Data type', vertex.ws_type, hrefs.type), definition('Narrative', vertex.narr_name, hrefs.narrative), definition('Path to object', formattedPath)])])]);

    tableRows.push(dataRow);
    tableRows.push(detailsRow);
  };

  for (var i = 0; i < this.data.length; ++i) {
    _loop(i);
  }
  return h('div', [h('table.table-lined', [h('thead', [h('tr', [h('th.sticky', ''), h('th.sticky', 'Name'), h('th.sticky', 'Date'), h('th.sticky', 'Creator'), h('th.sticky', 'Narrative')])]), h('tbody', tableRows)]), showIf(this.hasMore, function () {
    return h('div', [h('button.btn.mt2', {
      on: { click: function () {
          return _this3.fetchNext();
        } },
      props: { disabled: _this3.loadingMore }
    }, [showIf(_this3.loadingMore, 'Loading...'), showIf(!_this3.loadingMore, 'Load more')]), h('span.muted.inline-block.ml1', [_this3.totalCount - _this3.data.length, ' left'])]);
  }), showIf(!this.hasMore, function () {
    return h('p.muted', 'No more results');
  })]);
}
},{"../utils/apiClients":21,"../utils/formatDate":22,"../utils/objHrefs":24,"../utils/showIf":25,"../utils/typeName":29,"./Component.js":1,"./views/definition":6,"snabbdom/h":9}],5:[function(require,module,exports){
var serialize = require('form-serialize');
var h = require('snabbdom/h').default;
var Component = require('./Component');

// Form for manually submitting auth/endpoint/upa

module.exports = UpaForm;

function UpaForm() {
  var data = {
    kbaseEndpoint: window._env.kbaseEndpoint,
    authToken: window._env.authToken
  };
  if (document.location.search === '?form' && window.localStorage.upaFormData) {
    try {
      data = JSON.parse(window.localStorage.upaFormData);
    } catch (e) {
      console.error('Error loading upaFormData', e);
      window.localStorage.removeItem('upaFormData');
    }
  }
  return Component({ data: data, view: view });
}

function view() {
  var upaForm = this;
  // Only show when ?form is in the url
  if (document.location.search !== '?form') return h('div');
  return h('form.mb3', {
    on: {
      submit: function (ev) {
        ev.preventDefault();
        var formData = serialize(ev.currentTarget, { hash: true });
        window.localStorage.upaFormData = JSON.stringify(formData);
        window._messageHandlers.setConfig({ config: formData });
        upaForm.data = formData;
        // TODO newSearch(state, actions, state.upa)
      }
    }
  }, [h('fieldset.inline-block.mr2', [h('label.block.mb2.bold', 'KBase endpoint'), h('input.input.p1', {
    props: {
      required: true,
      type: 'text',
      name: 'kbaseEndpoint',
      value: upaForm.data.kbaseEndpoint
    }
  })]), h('fieldset.inline-block.mr2', [h('label.block.mb2.bold', 'Auth token'), h('input.input.p1', {
    props: {
      type: 'password',
      name: 'authToken',
      value: upaForm.data.authToken
    }
  })]), h('fieldset.inline-block', [h('label.block.mb2.bold', 'Object address'), h('input.input.p1', {
    props: {
      placeholder: '1/2/3',
      required: true,
      type: 'text',
      name: 'upa',
      value: upaForm.data.upa
    }
  })]), h('fieldset.clearfix.col-12.pt2', [h('button.btn', { props: { type: 'submit' } }, 'Submit')])]);
}
},{"./Component":1,"form-serialize":8,"snabbdom/h":9}],6:[function(require,module,exports){
var h = require('snabbdom/h').default;

// Term/label and definition (such as "Object" and "PF_NaOCL_trimm_paired")
module.exports = function (term, def, href) {
  var content = void 0;
  if (href) {
    content = h('a.inline-block.right.text-ellipsis.mw-36rem', { props: { href: href, target: '_blank' } }, def);
  } else {
    content = h('span.inline-block.right.text-ellipsis.mw-36rem', def);
  }
  return h('div.px1', [h('p.m0.py1.border-bottom.light-border', [h('span.bold.color-devil', term), content])]);
};
},{"snabbdom/h":9}],7:[function(require,module,exports){
// npm
var h = require('snabbdom/h').default;

// utils
var icons = require('./utils/icons');
var showIf = require('./utils/showIf');

var _require = require('./utils/apiClients'),
    fetchTypeCounts = _require.fetchTypeCounts;

var toObjKey = require('./utils/toObjKey');
var typeName = require('./utils/typeName');
var sortBy = require('./utils/sortBy');

// components
var Component = require('./components/Component');
var UpaForm = require('./components/UpaForm');

var _require2 = require('./components/HomologTable'),
    HomologTable = _require2.HomologTable;

var _require3 = require('./components/LinkedDataTable'),
    LinkedDataTable = _require3.LinkedDataTable;

function Page() {
  return Component({
    pendingInput: true,
    loading: false,
    obj: {}, // workspace object
    upaForm: UpaForm(),
    homologTable: HomologTable(),
    fetchUpa: function (upa) {
      var _this = this;

      this.obj.upa = upa;
      this.loading = true;
      this.pendingInput = false;
      this._render();
      var key = toObjKey(upa);
      this.homologTable.fetch(upa);
      fetchTypeCounts(key, null).then(function (resp) {
        if (resp.results && resp.results.length) {
          _this.typeCounts = mergeTypeCounts(resp.results[0].inb || {}, resp.results[0].out || {});
          _this.typeCounts = _this.typeCounts
          // Initialize a LinkedDataTable for each type result
          .map(function (entry) {
            entry.linkedDataTable = LinkedDataTable(key, entry.type, entry.count);
            return entry;
          });
        } else {
          _this.typeCounts = null;
        }
        _this.loading = false;
        _this._render();
      }).catch(function (err) {
        console.error(err);
        _this.loading = false;
        _this._render();
      });
    },
    fetchTypeList: function (entry) {
      // const { type } = entry
      if (!entry.linkedDataTable.data || !entry.linkedDataTable.data.length) {
        entry.linkedDataTable.fetchInitial();
      }
      this._render();
    },

    view: view
  });
}

function view() {
  var page = this;
  window._page = page;
  var div = function (content) {
    return h('div.container.px2.max-width-3', content);
  };
  if (page.pendingInput) {
    // We are still awaiting any post message for initial parameters..
    return div([page.upaForm.view(), h('p.muted', 'Waiting for input...')]);
  }
  return div([page.upaForm.view(), showIf(page.error, function () {
    return h('p.error', page.error);
  }), h('div', [typeHeaders(page), page.homologTable.view()])]);
}

function typeHeaders(page) {
  if (page.loading) {
    return h('p.muted', 'Searching for linked data...');
  }
  if (!page.typeCounts || !page.typeCounts.length) {
    return h('p.muted', 'No linked data results.');
  }
  return h('div', [h('h2.mt0', 'Linked Data'), h('div', page.typeCounts.map(function (entry) {
    var count = entry.count,
        expanded = entry.expanded;

    var iconColor = icons.colors[entry.typeName];
    // Get the first two letters of the type for the icon
    var iconInitial = entry.typeName.split('').filter(function (c) {
      return c === c.toUpperCase();
    }).slice(0, 3).join('');
    return h('div.relative.result-row.my2', [h('div.hover-parent', {
      on: {
        click: function () {
          entry.expanded = !entry.expanded;
          if (entry.expanded && !entry.subdata) {
            page.fetchTypeList(entry);
          } else {
            page._render();
          }
        }
      }
    }, [circleIcon(iconInitial, expanded, iconColor), h('h4.inline-block.m0', {
      style: { paddingLeft: '38px' }
    }, [entry.typeName, ' · ', h('span.muted', [count, ' total'])])]), showIf(entry.expanded, function () {
      return typeDataSection(page, entry);
    })]);
  }))]);
}

function typeDataSection(page, entry) {
  var iconColor = icons.colors[entry.typeName];
  return h('div.mb2.pt1.clearfix', {
    style: { paddingLeft: '38px' }
  }, [h('span.circle-line', {
    style: { background: iconColor }
  }), entry.linkedDataTable.view()]);
}

function circleIcon(contents, isExpanded, background) {
  return h('span.mr1.circle.inline-block', {
    class: {
      'hover-caret-up': isExpanded,
      'hover-caret-down': !isExpanded
    },
    style: { background: background }
  }, [h('span.hover-hide', [contents]), h('span.hover-arrow.hover-inline-block', isExpanded ? '−' : '+')]);
}

// This UI is used in an iframe, so we receive post messages from a parent window
window.addEventListener('message', receiveMessage, false);
// Default app config -- overridden by postMessage handlers further below
window._env = {
  kbaseEndpoint: 'https://kbase.us/services',
  kbaseRoot: 'https://narrative.kbase.us',
  sketchURL: 'https://kbase.us/dynserv/1b054633a008e078cec1a20dfd6d118d53c31ed4.sketch-service',
  relEngURL: 'https://kbase.us/services/relation_engine_api',
  authToken: null

  // Initialize the Page component
};document._page = Page();

// Receive JSON data in a post message
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

function mergeTypeCounts(inb, out) {
  // Convert inbound and outbound counts into a single merged object of simple type names
  var all = inb.concat(out)
  // Set some useful defaults
  .map(function (t) {
    return {
      type: t.type,
      count: t.type_count,
      typeVersion: t.type.match(/(\d+\.\d+)$/)[0],
      typeName: typeName(t.type)
    };
  });

  // Merge all types by type name
  var allObj = {};
  all.forEach(function (t) {
    var existing = allObj[t.typeName];
    if (existing) {
      var prevVersion = Number(existing.typeVersion);
      var thisVersion = Number(t.typeVersion);
      if (prevVersion === thisVersion) {
        // For multiple type counts of the same version, add them up
        allObj[t.typeName].count += t.count;
      } else if (Number(existing.typeVersion) < Number(t.typeVersion)) {
        // Favor and overwritethe higher-versioned types
        allObj[t.typeName] = t;
      }
    } else {
      allObj[t.typeName] = t;
    }
  });
  // Convert back to an array, sorted by type name
  return Object.values(allObj).sort(function (x, y) {
    return sortBy(x.typeName, y.typeName);
  });
}

// Handle post message methods
window._messageHandlers = {
  setConfig: function (_ref) {
    var config = _ref.config;

    window._env = Object.assign(window._env, config);
    if (config.upa) {
      document._page.fetchUpa(config.upa.replace(/:/g, '/'));
    }
  }

  // -- Render the page component
};document.body.appendChild(document._page._render().elm);
},{"./components/Component":1,"./components/HomologTable":3,"./components/LinkedDataTable":4,"./components/UpaForm":5,"./utils/apiClients":21,"./utils/icons":23,"./utils/showIf":25,"./utils/sortBy":26,"./utils/toObjKey":27,"./utils/typeName":29,"snabbdom/h":9}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vnode_1 = require("./vnode");
var is = require("./is");
function addNS(data, children, sel) {
    data.ns = 'http://www.w3.org/2000/svg';
    if (sel !== 'foreignObject' && children !== undefined) {
        for (var i = 0; i < children.length; ++i) {
            var childData = children[i].data;
            if (childData !== undefined) {
                addNS(childData, children[i].children, children[i].sel);
            }
        }
    }
}
function h(sel, b, c) {
    var data = {}, children, text, i;
    if (c !== undefined) {
        data = b;
        if (is.array(c)) {
            children = c;
        }
        else if (is.primitive(c)) {
            text = c;
        }
        else if (c && c.sel) {
            children = [c];
        }
    }
    else if (b !== undefined) {
        if (is.array(b)) {
            children = b;
        }
        else if (is.primitive(b)) {
            text = b;
        }
        else if (b && b.sel) {
            children = [b];
        }
        else {
            data = b;
        }
    }
    if (children !== undefined) {
        for (i = 0; i < children.length; ++i) {
            if (is.primitive(children[i]))
                children[i] = vnode_1.vnode(undefined, undefined, undefined, children[i], undefined);
        }
    }
    if (sel[0] === 's' && sel[1] === 'v' && sel[2] === 'g' &&
        (sel.length === 3 || sel[3] === '.' || sel[3] === '#')) {
        addNS(data, children, sel);
    }
    return vnode_1.vnode(sel, data, children, text, undefined);
}
exports.h = h;
;
exports.default = h;

},{"./is":11,"./vnode":20}],10:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function createElement(tagName) {
    return document.createElement(tagName);
}
function createElementNS(namespaceURI, qualifiedName) {
    return document.createElementNS(namespaceURI, qualifiedName);
}
function createTextNode(text) {
    return document.createTextNode(text);
}
function createComment(text) {
    return document.createComment(text);
}
function insertBefore(parentNode, newNode, referenceNode) {
    parentNode.insertBefore(newNode, referenceNode);
}
function removeChild(node, child) {
    node.removeChild(child);
}
function appendChild(node, child) {
    node.appendChild(child);
}
function parentNode(node) {
    return node.parentNode;
}
function nextSibling(node) {
    return node.nextSibling;
}
function tagName(elm) {
    return elm.tagName;
}
function setTextContent(node, text) {
    node.textContent = text;
}
function getTextContent(node) {
    return node.textContent;
}
function isElement(node) {
    return node.nodeType === 1;
}
function isText(node) {
    return node.nodeType === 3;
}
function isComment(node) {
    return node.nodeType === 8;
}
exports.htmlDomApi = {
    createElement: createElement,
    createElementNS: createElementNS,
    createTextNode: createTextNode,
    createComment: createComment,
    insertBefore: insertBefore,
    removeChild: removeChild,
    appendChild: appendChild,
    parentNode: parentNode,
    nextSibling: nextSibling,
    tagName: tagName,
    setTextContent: setTextContent,
    getTextContent: getTextContent,
    isElement: isElement,
    isText: isText,
    isComment: isComment,
};
exports.default = exports.htmlDomApi;

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.array = Array.isArray;
function primitive(s) {
    return typeof s === 'string' || typeof s === 'number';
}
exports.primitive = primitive;

},{}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var xlinkNS = 'http://www.w3.org/1999/xlink';
var xmlNS = 'http://www.w3.org/XML/1998/namespace';
var colonChar = 58;
var xChar = 120;
function updateAttrs(oldVnode, vnode) {
    var key, elm = vnode.elm, oldAttrs = oldVnode.data.attrs, attrs = vnode.data.attrs;
    if (!oldAttrs && !attrs)
        return;
    if (oldAttrs === attrs)
        return;
    oldAttrs = oldAttrs || {};
    attrs = attrs || {};
    // update modified attributes, add new attributes
    for (key in attrs) {
        var cur = attrs[key];
        var old = oldAttrs[key];
        if (old !== cur) {
            if (cur === true) {
                elm.setAttribute(key, "");
            }
            else if (cur === false) {
                elm.removeAttribute(key);
            }
            else {
                if (key.charCodeAt(0) !== xChar) {
                    elm.setAttribute(key, cur);
                }
                else if (key.charCodeAt(3) === colonChar) {
                    // Assume xml namespace
                    elm.setAttributeNS(xmlNS, key, cur);
                }
                else if (key.charCodeAt(5) === colonChar) {
                    // Assume xlink namespace
                    elm.setAttributeNS(xlinkNS, key, cur);
                }
                else {
                    elm.setAttribute(key, cur);
                }
            }
        }
    }
    // remove removed attributes
    // use `in` operator since the previous `for` iteration uses it (.i.e. add even attributes with undefined value)
    // the other option is to remove all attributes with value == undefined
    for (key in oldAttrs) {
        if (!(key in attrs)) {
            elm.removeAttribute(key);
        }
    }
}
exports.attributesModule = { create: updateAttrs, update: updateAttrs };
exports.default = exports.attributesModule;

},{}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function updateClass(oldVnode, vnode) {
    var cur, name, elm = vnode.elm, oldClass = oldVnode.data.class, klass = vnode.data.class;
    if (!oldClass && !klass)
        return;
    if (oldClass === klass)
        return;
    oldClass = oldClass || {};
    klass = klass || {};
    for (name in oldClass) {
        if (!klass[name]) {
            elm.classList.remove(name);
        }
    }
    for (name in klass) {
        cur = klass[name];
        if (cur !== oldClass[name]) {
            elm.classList[cur ? 'add' : 'remove'](name);
        }
    }
}
exports.classModule = { create: updateClass, update: updateClass };
exports.default = exports.classModule;

},{}],14:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var CAPS_REGEX = /[A-Z]/g;
function updateDataset(oldVnode, vnode) {
    var elm = vnode.elm, oldDataset = oldVnode.data.dataset, dataset = vnode.data.dataset, key;
    if (!oldDataset && !dataset)
        return;
    if (oldDataset === dataset)
        return;
    oldDataset = oldDataset || {};
    dataset = dataset || {};
    var d = elm.dataset;
    for (key in oldDataset) {
        if (!dataset[key]) {
            if (d) {
                if (key in d) {
                    delete d[key];
                }
            }
            else {
                elm.removeAttribute('data-' + key.replace(CAPS_REGEX, '-$&').toLowerCase());
            }
        }
    }
    for (key in dataset) {
        if (oldDataset[key] !== dataset[key]) {
            if (d) {
                d[key] = dataset[key];
            }
            else {
                elm.setAttribute('data-' + key.replace(CAPS_REGEX, '-$&').toLowerCase(), dataset[key]);
            }
        }
    }
}
exports.datasetModule = { create: updateDataset, update: updateDataset };
exports.default = exports.datasetModule;

},{}],15:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function invokeHandler(handler, vnode, event) {
    if (typeof handler === "function") {
        // call function handler
        handler.call(vnode, event, vnode);
    }
    else if (typeof handler === "object") {
        // call handler with arguments
        if (typeof handler[0] === "function") {
            // special case for single argument for performance
            if (handler.length === 2) {
                handler[0].call(vnode, handler[1], event, vnode);
            }
            else {
                var args = handler.slice(1);
                args.push(event);
                args.push(vnode);
                handler[0].apply(vnode, args);
            }
        }
        else {
            // call multiple handlers
            for (var i = 0; i < handler.length; i++) {
                invokeHandler(handler[i], vnode, event);
            }
        }
    }
}
function handleEvent(event, vnode) {
    var name = event.type, on = vnode.data.on;
    // call event handler(s) if exists
    if (on && on[name]) {
        invokeHandler(on[name], vnode, event);
    }
}
function createListener() {
    return function handler(event) {
        handleEvent(event, handler.vnode);
    };
}
function updateEventListeners(oldVnode, vnode) {
    var oldOn = oldVnode.data.on, oldListener = oldVnode.listener, oldElm = oldVnode.elm, on = vnode && vnode.data.on, elm = (vnode && vnode.elm), name;
    // optimization for reused immutable handlers
    if (oldOn === on) {
        return;
    }
    // remove existing listeners which no longer used
    if (oldOn && oldListener) {
        // if element changed or deleted we remove all existing listeners unconditionally
        if (!on) {
            for (name in oldOn) {
                // remove listener if element was changed or existing listeners removed
                oldElm.removeEventListener(name, oldListener, false);
            }
        }
        else {
            for (name in oldOn) {
                // remove listener if existing listener removed
                if (!on[name]) {
                    oldElm.removeEventListener(name, oldListener, false);
                }
            }
        }
    }
    // add new listeners which has not already attached
    if (on) {
        // reuse existing listener or create new
        var listener = vnode.listener = oldVnode.listener || createListener();
        // update vnode for listener
        listener.vnode = vnode;
        // if element changed or added we add all needed listeners unconditionally
        if (!oldOn) {
            for (name in on) {
                // add listener if element was changed or new listeners added
                elm.addEventListener(name, listener, false);
            }
        }
        else {
            for (name in on) {
                // add listener if new listener added
                if (!oldOn[name]) {
                    elm.addEventListener(name, listener, false);
                }
            }
        }
    }
}
exports.eventListenersModule = {
    create: updateEventListeners,
    update: updateEventListeners,
    destroy: updateEventListeners
};
exports.default = exports.eventListenersModule;

},{}],16:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function updateProps(oldVnode, vnode) {
    var key, cur, old, elm = vnode.elm, oldProps = oldVnode.data.props, props = vnode.data.props;
    if (!oldProps && !props)
        return;
    if (oldProps === props)
        return;
    oldProps = oldProps || {};
    props = props || {};
    for (key in oldProps) {
        if (!props[key]) {
            delete elm[key];
        }
    }
    for (key in props) {
        cur = props[key];
        old = oldProps[key];
        if (old !== cur && (key !== 'value' || elm[key] !== cur)) {
            elm[key] = cur;
        }
    }
}
exports.propsModule = { create: updateProps, update: updateProps };
exports.default = exports.propsModule;

},{}],17:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Bindig `requestAnimationFrame` like this fixes a bug in IE/Edge. See #360 and #409.
var raf = (typeof window !== 'undefined' && (window.requestAnimationFrame).bind(window)) || setTimeout;
var nextFrame = function (fn) { raf(function () { raf(fn); }); };
var reflowForced = false;
function setNextFrame(obj, prop, val) {
    nextFrame(function () { obj[prop] = val; });
}
function updateStyle(oldVnode, vnode) {
    var cur, name, elm = vnode.elm, oldStyle = oldVnode.data.style, style = vnode.data.style;
    if (!oldStyle && !style)
        return;
    if (oldStyle === style)
        return;
    oldStyle = oldStyle || {};
    style = style || {};
    var oldHasDel = 'delayed' in oldStyle;
    for (name in oldStyle) {
        if (!style[name]) {
            if (name[0] === '-' && name[1] === '-') {
                elm.style.removeProperty(name);
            }
            else {
                elm.style[name] = '';
            }
        }
    }
    for (name in style) {
        cur = style[name];
        if (name === 'delayed' && style.delayed) {
            for (var name2 in style.delayed) {
                cur = style.delayed[name2];
                if (!oldHasDel || cur !== oldStyle.delayed[name2]) {
                    setNextFrame(elm.style, name2, cur);
                }
            }
        }
        else if (name !== 'remove' && cur !== oldStyle[name]) {
            if (name[0] === '-' && name[1] === '-') {
                elm.style.setProperty(name, cur);
            }
            else {
                elm.style[name] = cur;
            }
        }
    }
}
function applyDestroyStyle(vnode) {
    var style, name, elm = vnode.elm, s = vnode.data.style;
    if (!s || !(style = s.destroy))
        return;
    for (name in style) {
        elm.style[name] = style[name];
    }
}
function applyRemoveStyle(vnode, rm) {
    var s = vnode.data.style;
    if (!s || !s.remove) {
        rm();
        return;
    }
    if (!reflowForced) {
        getComputedStyle(document.body).transform;
        reflowForced = true;
    }
    var name, elm = vnode.elm, i = 0, compStyle, style = s.remove, amount = 0, applied = [];
    for (name in style) {
        applied.push(name);
        elm.style[name] = style[name];
    }
    compStyle = getComputedStyle(elm);
    var props = compStyle['transition-property'].split(', ');
    for (; i < props.length; ++i) {
        if (applied.indexOf(props[i]) !== -1)
            amount++;
    }
    elm.addEventListener('transitionend', function (ev) {
        if (ev.target === elm)
            --amount;
        if (amount === 0)
            rm();
    });
}
function forceReflow() {
    reflowForced = false;
}
exports.styleModule = {
    pre: forceReflow,
    create: updateStyle,
    update: updateStyle,
    destroy: applyDestroyStyle,
    remove: applyRemoveStyle
};
exports.default = exports.styleModule;

},{}],18:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vnode_1 = require("./vnode");
var is = require("./is");
var htmldomapi_1 = require("./htmldomapi");
function isUndef(s) { return s === undefined; }
function isDef(s) { return s !== undefined; }
var emptyNode = vnode_1.default('', {}, [], undefined, undefined);
function sameVnode(vnode1, vnode2) {
    return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel;
}
function isVnode(vnode) {
    return vnode.sel !== undefined;
}
function createKeyToOldIdx(children, beginIdx, endIdx) {
    var i, map = {}, key, ch;
    for (i = beginIdx; i <= endIdx; ++i) {
        ch = children[i];
        if (ch != null) {
            key = ch.key;
            if (key !== undefined)
                map[key] = i;
        }
    }
    return map;
}
var hooks = ['create', 'update', 'remove', 'destroy', 'pre', 'post'];
var h_1 = require("./h");
exports.h = h_1.h;
var thunk_1 = require("./thunk");
exports.thunk = thunk_1.thunk;
function init(modules, domApi) {
    var i, j, cbs = {};
    var api = domApi !== undefined ? domApi : htmldomapi_1.default;
    for (i = 0; i < hooks.length; ++i) {
        cbs[hooks[i]] = [];
        for (j = 0; j < modules.length; ++j) {
            var hook = modules[j][hooks[i]];
            if (hook !== undefined) {
                cbs[hooks[i]].push(hook);
            }
        }
    }
    function emptyNodeAt(elm) {
        var id = elm.id ? '#' + elm.id : '';
        var c = elm.className ? '.' + elm.className.split(' ').join('.') : '';
        return vnode_1.default(api.tagName(elm).toLowerCase() + id + c, {}, [], undefined, elm);
    }
    function createRmCb(childElm, listeners) {
        return function rmCb() {
            if (--listeners === 0) {
                var parent_1 = api.parentNode(childElm);
                api.removeChild(parent_1, childElm);
            }
        };
    }
    function createElm(vnode, insertedVnodeQueue) {
        var i, data = vnode.data;
        if (data !== undefined) {
            if (isDef(i = data.hook) && isDef(i = i.init)) {
                i(vnode);
                data = vnode.data;
            }
        }
        var children = vnode.children, sel = vnode.sel;
        if (sel === '!') {
            if (isUndef(vnode.text)) {
                vnode.text = '';
            }
            vnode.elm = api.createComment(vnode.text);
        }
        else if (sel !== undefined) {
            // Parse selector
            var hashIdx = sel.indexOf('#');
            var dotIdx = sel.indexOf('.', hashIdx);
            var hash = hashIdx > 0 ? hashIdx : sel.length;
            var dot = dotIdx > 0 ? dotIdx : sel.length;
            var tag = hashIdx !== -1 || dotIdx !== -1 ? sel.slice(0, Math.min(hash, dot)) : sel;
            var elm = vnode.elm = isDef(data) && isDef(i = data.ns) ? api.createElementNS(i, tag)
                : api.createElement(tag);
            if (hash < dot)
                elm.setAttribute('id', sel.slice(hash + 1, dot));
            if (dotIdx > 0)
                elm.setAttribute('class', sel.slice(dot + 1).replace(/\./g, ' '));
            for (i = 0; i < cbs.create.length; ++i)
                cbs.create[i](emptyNode, vnode);
            if (is.array(children)) {
                for (i = 0; i < children.length; ++i) {
                    var ch = children[i];
                    if (ch != null) {
                        api.appendChild(elm, createElm(ch, insertedVnodeQueue));
                    }
                }
            }
            else if (is.primitive(vnode.text)) {
                api.appendChild(elm, api.createTextNode(vnode.text));
            }
            i = vnode.data.hook; // Reuse variable
            if (isDef(i)) {
                if (i.create)
                    i.create(emptyNode, vnode);
                if (i.insert)
                    insertedVnodeQueue.push(vnode);
            }
        }
        else {
            vnode.elm = api.createTextNode(vnode.text);
        }
        return vnode.elm;
    }
    function addVnodes(parentElm, before, vnodes, startIdx, endIdx, insertedVnodeQueue) {
        for (; startIdx <= endIdx; ++startIdx) {
            var ch = vnodes[startIdx];
            if (ch != null) {
                api.insertBefore(parentElm, createElm(ch, insertedVnodeQueue), before);
            }
        }
    }
    function invokeDestroyHook(vnode) {
        var i, j, data = vnode.data;
        if (data !== undefined) {
            if (isDef(i = data.hook) && isDef(i = i.destroy))
                i(vnode);
            for (i = 0; i < cbs.destroy.length; ++i)
                cbs.destroy[i](vnode);
            if (vnode.children !== undefined) {
                for (j = 0; j < vnode.children.length; ++j) {
                    i = vnode.children[j];
                    if (i != null && typeof i !== "string") {
                        invokeDestroyHook(i);
                    }
                }
            }
        }
    }
    function removeVnodes(parentElm, vnodes, startIdx, endIdx) {
        for (; startIdx <= endIdx; ++startIdx) {
            var i_1 = void 0, listeners = void 0, rm = void 0, ch = vnodes[startIdx];
            if (ch != null) {
                if (isDef(ch.sel)) {
                    invokeDestroyHook(ch);
                    listeners = cbs.remove.length + 1;
                    rm = createRmCb(ch.elm, listeners);
                    for (i_1 = 0; i_1 < cbs.remove.length; ++i_1)
                        cbs.remove[i_1](ch, rm);
                    if (isDef(i_1 = ch.data) && isDef(i_1 = i_1.hook) && isDef(i_1 = i_1.remove)) {
                        i_1(ch, rm);
                    }
                    else {
                        rm();
                    }
                }
                else {
                    api.removeChild(parentElm, ch.elm);
                }
            }
        }
    }
    function updateChildren(parentElm, oldCh, newCh, insertedVnodeQueue) {
        var oldStartIdx = 0, newStartIdx = 0;
        var oldEndIdx = oldCh.length - 1;
        var oldStartVnode = oldCh[0];
        var oldEndVnode = oldCh[oldEndIdx];
        var newEndIdx = newCh.length - 1;
        var newStartVnode = newCh[0];
        var newEndVnode = newCh[newEndIdx];
        var oldKeyToIdx;
        var idxInOld;
        var elmToMove;
        var before;
        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
            if (oldStartVnode == null) {
                oldStartVnode = oldCh[++oldStartIdx]; // Vnode might have been moved left
            }
            else if (oldEndVnode == null) {
                oldEndVnode = oldCh[--oldEndIdx];
            }
            else if (newStartVnode == null) {
                newStartVnode = newCh[++newStartIdx];
            }
            else if (newEndVnode == null) {
                newEndVnode = newCh[--newEndIdx];
            }
            else if (sameVnode(oldStartVnode, newStartVnode)) {
                patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
                oldStartVnode = oldCh[++oldStartIdx];
                newStartVnode = newCh[++newStartIdx];
            }
            else if (sameVnode(oldEndVnode, newEndVnode)) {
                patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
                oldEndVnode = oldCh[--oldEndIdx];
                newEndVnode = newCh[--newEndIdx];
            }
            else if (sameVnode(oldStartVnode, newEndVnode)) {
                patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
                api.insertBefore(parentElm, oldStartVnode.elm, api.nextSibling(oldEndVnode.elm));
                oldStartVnode = oldCh[++oldStartIdx];
                newEndVnode = newCh[--newEndIdx];
            }
            else if (sameVnode(oldEndVnode, newStartVnode)) {
                patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);
                api.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
                oldEndVnode = oldCh[--oldEndIdx];
                newStartVnode = newCh[++newStartIdx];
            }
            else {
                if (oldKeyToIdx === undefined) {
                    oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
                }
                idxInOld = oldKeyToIdx[newStartVnode.key];
                if (isUndef(idxInOld)) {
                    api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
                    newStartVnode = newCh[++newStartIdx];
                }
                else {
                    elmToMove = oldCh[idxInOld];
                    if (elmToMove.sel !== newStartVnode.sel) {
                        api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
                    }
                    else {
                        patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);
                        oldCh[idxInOld] = undefined;
                        api.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm);
                    }
                    newStartVnode = newCh[++newStartIdx];
                }
            }
        }
        if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
            if (oldStartIdx > oldEndIdx) {
                before = newCh[newEndIdx + 1] == null ? null : newCh[newEndIdx + 1].elm;
                addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
            }
            else {
                removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
            }
        }
    }
    function patchVnode(oldVnode, vnode, insertedVnodeQueue) {
        var i, hook;
        if (isDef(i = vnode.data) && isDef(hook = i.hook) && isDef(i = hook.prepatch)) {
            i(oldVnode, vnode);
        }
        var elm = vnode.elm = oldVnode.elm;
        var oldCh = oldVnode.children;
        var ch = vnode.children;
        if (oldVnode === vnode)
            return;
        if (vnode.data !== undefined) {
            for (i = 0; i < cbs.update.length; ++i)
                cbs.update[i](oldVnode, vnode);
            i = vnode.data.hook;
            if (isDef(i) && isDef(i = i.update))
                i(oldVnode, vnode);
        }
        if (isUndef(vnode.text)) {
            if (isDef(oldCh) && isDef(ch)) {
                if (oldCh !== ch)
                    updateChildren(elm, oldCh, ch, insertedVnodeQueue);
            }
            else if (isDef(ch)) {
                if (isDef(oldVnode.text))
                    api.setTextContent(elm, '');
                addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
            }
            else if (isDef(oldCh)) {
                removeVnodes(elm, oldCh, 0, oldCh.length - 1);
            }
            else if (isDef(oldVnode.text)) {
                api.setTextContent(elm, '');
            }
        }
        else if (oldVnode.text !== vnode.text) {
            if (isDef(oldCh)) {
                removeVnodes(elm, oldCh, 0, oldCh.length - 1);
            }
            api.setTextContent(elm, vnode.text);
        }
        if (isDef(hook) && isDef(i = hook.postpatch)) {
            i(oldVnode, vnode);
        }
    }
    return function patch(oldVnode, vnode) {
        var i, elm, parent;
        var insertedVnodeQueue = [];
        for (i = 0; i < cbs.pre.length; ++i)
            cbs.pre[i]();
        if (!isVnode(oldVnode)) {
            oldVnode = emptyNodeAt(oldVnode);
        }
        if (sameVnode(oldVnode, vnode)) {
            patchVnode(oldVnode, vnode, insertedVnodeQueue);
        }
        else {
            elm = oldVnode.elm;
            parent = api.parentNode(elm);
            createElm(vnode, insertedVnodeQueue);
            if (parent !== null) {
                api.insertBefore(parent, vnode.elm, api.nextSibling(elm));
                removeVnodes(parent, [oldVnode], 0, 0);
            }
        }
        for (i = 0; i < insertedVnodeQueue.length; ++i) {
            insertedVnodeQueue[i].data.hook.insert(insertedVnodeQueue[i]);
        }
        for (i = 0; i < cbs.post.length; ++i)
            cbs.post[i]();
        return vnode;
    };
}
exports.init = init;

},{"./h":9,"./htmldomapi":10,"./is":11,"./thunk":19,"./vnode":20}],19:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var h_1 = require("./h");
function copyToThunk(vnode, thunk) {
    thunk.elm = vnode.elm;
    vnode.data.fn = thunk.data.fn;
    vnode.data.args = thunk.data.args;
    thunk.data = vnode.data;
    thunk.children = vnode.children;
    thunk.text = vnode.text;
    thunk.elm = vnode.elm;
}
function init(thunk) {
    var cur = thunk.data;
    var vnode = cur.fn.apply(undefined, cur.args);
    copyToThunk(vnode, thunk);
}
function prepatch(oldVnode, thunk) {
    var i, old = oldVnode.data, cur = thunk.data;
    var oldArgs = old.args, args = cur.args;
    if (old.fn !== cur.fn || oldArgs.length !== args.length) {
        copyToThunk(cur.fn.apply(undefined, args), thunk);
        return;
    }
    for (i = 0; i < args.length; ++i) {
        if (oldArgs[i] !== args[i]) {
            copyToThunk(cur.fn.apply(undefined, args), thunk);
            return;
        }
    }
    copyToThunk(oldVnode, thunk);
}
exports.thunk = function thunk(sel, key, fn, args) {
    if (args === undefined) {
        args = fn;
        fn = key;
        key = undefined;
    }
    return h_1.h(sel, {
        key: key,
        hook: { init: init, prepatch: prepatch },
        fn: fn,
        args: args
    });
};
exports.default = exports.thunk;

},{"./h":9}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function vnode(sel, data, children, text, elm) {
    var key = data === undefined ? undefined : data.key;
    return { sel: sel, data: data, children: children,
        text: text, elm: elm, key: key };
}
exports.vnode = vnode;
exports.default = vnode;

},{}],21:[function(require,module,exports){
module.exports = { fetchLinkedObjs: fetchLinkedObjs, fetchHomologs: fetchHomologs, fetchTypeCounts: fetchTypeCounts, fetchKnowledgeScores: fetchKnowledgeScores, fetchReferences: fetchReferences

  // Outbound linked data are objects that our current object has led to the creation of
  // Inbound linked data are objects that our current object is created from

};function fetchLinkedObjs(key, options) {
  var payload = {
    obj_key: key,
    owners: false,
    type: options.type,
    show_private: true,
    show_public: true,
    offset: options.offset,
    results_limit: options.limit
  };
  return aqlQuery(payload, { view: 'wsprov_fetch_linked_objects' });
}

function fetchKnowledgeScores(ids) {
  var payload = {
    obj_ids: ids,
    prop: 'knowledge_score'
  };
  return aqlQuery(payload, { view: 'wsprov_fetch_obj_field', batch_size: 500 });
}

function fetchTypeCounts(key) {
  var payload = {
    obj_key: key,
    owners: false,
    type: false,
    show_private: true,
    show_public: true
  };
  return aqlQuery(payload, { view: 'wsprov_count_linked_object_types' });
}

function fetchReferences(key) {
  var payload = {
    obj_key: key,
    result_limit: 10,
    offset: 0
  };
  return aqlQuery(payload, { view: 'wsprov_fetch_references' });
}

// Use the sketch service to fetch homologs (only applicable to reads, assemblies, or annotations)
// For each homolog with a kbase_id, fetch the sub-links
function fetchHomologs(upa, token) {
  var url = window._env.sketchURL;
  var payload = {
    method: 'get_homologs',
    params: { ws_ref: upa, n_max_results: 500 }
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

// Make a request to the relation engine api to do an ad-hoc admin query for prototyping
function aqlQuery(payload, params) {
  var token = window._env.authToken;
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
    if (json && json.results) return json;
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
},{}],22:[function(require,module,exports){
module.exports = formatDate;

// Convert a string representing a date into a standard-formatted string of MM/DD/YYYY
// Fall back to the original string if anything fails

function formatDate(str) {
  try {
    var date = new Date(Date.parse(str));
    var formatted = date.toLocaleDateString('en-US');
    if (formatted === 'Invalid Date') return str;
    return formatted;
  } catch (e) {
    return str;
  }
}
},{}],23:[function(require,module,exports){
var colorMapping = {
  AssemblyInput: '#F44336',
  Assembly: '#920D58',

  ChromatographyMatrix: '#E91E63',
  Collection: '#E91E63',

  Genome: '#3F51B5',
  ContigSet: '#3F51B5',

  DomainAlignment: '#000000',
  EstimateKResult: '#000000',

  ExpressionMatrix: '#2196F3',
  DifferentialExpressionMatrix: '#2196F3',
  ExpressionSample: '#2196F3',
  ExpressionSeries: '#2196F3',

  FBA: '#673AB7',
  FBAModel: '#673AB7',

  FeatureClusters: '#AEEA00',

  Feature: 'rgb(141, 175, 42)',
  FeatureSet: 'rgb(141, 175, 42)',

  FunctionalMatrix: '#000000',
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
  PairedEndLibrary: '#795548',

  Taxon: '#920D58',
  TaxonomicMatrix: '#795548',
  Tree: '#795548',

  RNASeqAlignment: 'rgb(183, 58, 58)',
  RNASeqExpression: 'rgb(183, 58, 58)',
  RNASeqSampleSet: 'rgb(183, 58, 58)',
  RNASeqAlignmentSet: 'rgb(183, 58, 58)'
};

module.exports = { colors: colorMapping };
},{}],24:[function(require,module,exports){
var toUpa = require('./toUpa');

module.exports = objHrefs;

// Generate KBase url links for an object
function objHrefs(obj) {
  var url = window._env.kbaseRoot;
  var dataview = url + '/#dataview/';
  var typeUrl = url + '/#spec/type/';
  var hrefs = {};
  if (obj.ws_type) {
    hrefs.type = typeUrl + obj.ws_type;
  }
  if (obj.upa) {
    hrefs.obj = dataview + obj.upa;
  } else if (obj._key) {
    hrefs.obj = dataview + toUpa(obj._key);
  }
  if (obj.workspace_id) {
    hrefs.narrative = 'https://narrative.kbase.us/narrative/ws.' + obj.workspace_id + '.obj.1';
  }
  if (obj.owner) {
    hrefs.owner = url + '/#people/' + obj.owner;
  }
  return hrefs;
}
},{"./toUpa":28}],25:[function(require,module,exports){
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
},{}],26:[function(require,module,exports){
module.exports = sortBy;

function sortBy(x, y) {
  if (x > y) return 1;
  if (x < y) return -1;
  return 0;
}
},{}],27:[function(require,module,exports){
// Convert an upa to an arango object key
// '1/2/3' -> '1:2:3'
module.exports = function (upa) {
  return upa.replace(/\//g, ':');
};
},{}],28:[function(require,module,exports){
// Convert an arango object key to an upa
// '1:2:3' -> '1/2/3'
module.exports = function (key) {
  return key.replace(/:/g, '/');
};
},{}],29:[function(require,module,exports){

module.exports = typeName;

// Convert something like "Module.Type-5.0" into just "Type"
// Returns the input if we cannot match the format
function typeName(typeStr) {
  var matches = typeStr.match(/^.+\.(.+)-.+$/);
  if (!matches) return typeStr;
  return matches[1];
}
},{}]},{},[7]);
