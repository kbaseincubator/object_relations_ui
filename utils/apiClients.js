module.exports = { fetchLinkedObjs, fetchHomologs, fetchTypeCounts, fetchKnowledgeScores }

// Outbound linked data are objects that our current object has led to the creation of
// Inbound linked data are objects that our current object is created from

function fetchLinkedObjs (key, options) {
  const payload = {
    obj_key: key,
    owners: false,
    type: options.type,
    show_private: true,
    show_public: true,
    offset: options.offset,
    results_limit: options.limit
  }
  return aqlQuery(payload, { view: 'wsprov_fetch_linked_objects' })
}

function fetchKnowledgeScores (ids) {
  const payload = {
    obj_ids: ids,
    prop: 'knowledge_score'
  }
  return aqlQuery(payload, { view: 'wsprov_fetch_obj_field' })
}

function fetchTypeCounts (key) {
  const payload = {
    obj_key: key,
    owners: false,
    type: false,
    show_private: true,
    show_public: true
  }
  return aqlQuery(payload, { view: 'wsprov_count_linked_object_types' })
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
function aqlQuery (payload, params) {
  const token = window._env.authToken
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
