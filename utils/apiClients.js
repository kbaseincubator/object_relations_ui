module.exports = { fetchLinkedObjs, fetchCopies, fetchHomologs, fetchObj, fetchTypeCounts }

/*
// Fetch all linked and sub-linked data from an upa
function fetchLinkedObjs (upas) {
  upas = upas.map(formatObjKey)
  const payload = { obj_keys: upas, link_limit: 10 }
  const token = window._env.authToken
  return aqlQuery(payload, token, { view: 'wsprov_fetch_linked_objects' })
}
*/

const typeCountsQuery = `
with wsprov_object
let obj_id = CONCAT("wsprov_object/", @obj_key)
for v, e, p in 1..@max_depth
  any obj_id wsprov_links, wsprov_copied_into
  options {uniqueVertices: "global", bfs: true}
  filter p.vertices[1].is_taxon != true
  FILTER (@show_private && @show_public) ? (v.is_public || v.workspace_id IN @ws_ids) :
      (!@show_private || v.workspace_id IN @ws_ids) && (!@show_public || v.is_public)
  collect type = v.ws_type with count into type_count
  return {type, type_count}
`

const linkedQuery = `
with wsprov_object
let obj_id = CONCAT("wsprov_object/", @obj_key)
for v, e, p in 1..@max_depth
    any obj_id wsprov_links, wsprov_copied_into
    options {uniqueVertices: "global", bfs: true}
    FILTER p.vertices[1].is_taxon != true
    FILTER (!@types || v.workspace_type IN @types)
    FILTER (!@owners || v.owner IN @owners)
    FILTER (@show_private && @show_public) ? (v.is_public || v.workspace_id IN @ws_ids) :
        (!@show_private || v.workspace_id IN @ws_ids) && (!@show_public || v.is_public)
    return {
        vertex: {
            _key: v._key,
            is_public: v.is_public,
            narr_name: v.narr_name,
            obj_name: v.obj_name,
            owner: v.owner,
            save_date: v.save_date,
            workspace_id: v.workspace_id,
            ws_type: v.ws_type
        },
        path: {
            edges: p.edges[*]._id,
            verts: p.vertices[*]._id
        }
    }
`

function fetchLinkedObjs (key) {
  const payload = {
    query: linkedQuery,
    max_depth: 3,
    obj_key: key,
    types: false,
    owners: false,
    show_private: true,
    show_public: true,
    ws_ids: [39200]
  }
  const token = window._env.authToken
  return aqlQuery(payload, token)
}

function fetchTypeCounts (key) {
  const payload = {
    max_depth: 3,
    show_public: true,
    show_private: true,
  }
  const token = window._env.authToken
  return aqlQuery(payload, token)
}

window.fetchLinkedObjs = fetchLinkedObjs

// Fetch all copies and linked objects of those copies from an upa
function fetchCopies (upa) {
  const payload = { obj_key: formatObjKey(upa), copy_limit: 50 }
  const token = window._env.authToken
  return aqlQuery(payload, token, { view: 'wsprov_fetch_copies' })
}

/*
function fetchTypeCounts (upa) {
  const payload = { key: formatObjKey(upa), is_private: false, is_public: false, owners: false, simplify_type: false }
  const token = window._env.authToken
  return aqlQuery(payload, token, { view: 'list_referencing_type_counts' })
}
*/

function formatObjKey (upa) {
  // UPA delimiter in arango is a ':' rather than a '/'
  return upa.replace(/\//g, ':')
}

// Use the sketch service to fetch homologs (only applicable to reads, assemblies, or annotations)
// For each homolog with a kbase_id, fetch the sub-links
function fetchHomologs (upa, token) {
  const url = window._env.sketchURL
  const payload = {
    method: 'get_homologs',
    params: [upa]
  }
  const headers = {}
  if (window._env.authToken) {
    headers.Authorization = window._env.authToken
  }
  return window.fetch(url, {
    method: 'POST',
    headers,
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
window.fetchRandom = fetchRandom

function fetchObj (upa, token) {
  // Fetch info about an object
  const payload = { obj_key: upa.replace(/\//g, ':') }
  return aqlQuery(payload, token, { view: 'wsprov_fetch_object' })
}

// Make a request to the relation engine api to do an ad-hoc admin query for prototyping
function aqlQuery (payload, token, params) {
  const apiUrl = window._env.relEngURL.replace(/\/$/, '') // remove trailing slash
  const url = apiUrl + '/api/query_results/' + queryify(params)
  const headers = {}
  if (token) headers.Authorization = token
  return window.fetch(url, {
    method: 'POST',
    headers,
    mode: 'cors',
    body: JSON.stringify(payload)
  })
    .then(resp => resp.json())
    .then(json => {
      if (json && json.results) return json
      if (json && json.error) throw new Error(json.error)
    })
}

// Convert a js object into url querystring params
function queryify (params) {
  const items = []
  for (let name in params) {
    items.push(encodeURIComponent(name) + '=' + encodeURIComponent(params[name]))
  }
  return '?' + items.join('&')
}
