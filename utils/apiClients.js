module.exports = { fetchLinkedObjs, fetchHomologs, fetchTypeCounts }

const linkedQuery = `
WITH wsprov_object
LET obj_id = CONCAT("wsprov_object/", @obj_key)
FOR v, e, p IN 1..100
    INBOUND obj_id wsprov_links, wsprov_copied_into
    OPTIONS {uniqueVertices: "global", bfs: true}
    FILTER (!@type || v.ws_type == @type)
    FILTER (!@owners || v.owner IN @owners)
    FILTER (@show_private && @show_public) ? (v.is_public || v.workspace_id IN @ws_ids) :
        (!@show_private || v.workspace_id IN @ws_ids) && (!@show_public || v.is_public)
    LIMIT @offset, @results_limit
    RETURN {
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

function fetchLinkedObjs (key, options) {
  console.log('options', options)
  const payload = {
    query: linkedQuery,
    obj_key: key,
    owners: false,
    type: options.type,
    show_private: true,
    show_public: true,
    offset: options.offset,
    results_limit: options.limit
  }
  const token = window._env.authToken
  return aqlQuery(payload, token)
}

const typeCountsQuery = `
WITH wsprov_object
LET obj_id = CONCAT("wsprov_object/", @obj_key)
FOR v, e, p in 1..100
  INBOUND obj_id wsprov_links, wsprov_copied_into
  OPTIONS {uniqueVertices: "global", bfs: true}
  FILTER (@show_private && @show_public) ? (v.is_public || v.workspace_id IN @ws_ids) :
      (!@show_private || v.workspace_id IN @ws_ids) && (!@show_public || v.is_public)
  COLLECT type = v.ws_type with count into type_count
  SORT type_count DESC
  RETURN {type, type_count}
`

function fetchTypeCounts (key) {
  const payload = {
    obj_key: key,
    query: typeCountsQuery,
    show_public: true,
    show_private: true
  }
  const token = window._env.authToken
  return aqlQuery(payload, token)
}

// Use the sketch service to fetch homologs (only applicable to reads, assemblies, or annotations)
// For each homolog with a kbase_id, fetch the sub-links
function fetchHomologs (upa, token) {
  const url = window._env.sketchURL
  const payload = {
    method: 'get_homologs',
    params: { ws_ref: upa, n_max_results: 500 }
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

// Make a request to the relation engine api to do an ad-hoc admin query for prototyping
function aqlQuery (payload, token, params) {
  const apiUrl = window._env.relEngURL.replace(/\/$/, '') // remove trailing slash
  const url = apiUrl + '/api/query_results/' + queryify(params)
  console.log({ url })
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
