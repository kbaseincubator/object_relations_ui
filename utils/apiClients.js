module.exports = { fetchLinkedObjs, fetchCopies, fetchHomologs, fetchObj }

// Fetch all linked and sub-linked data from an upa
function fetchLinkedObjs (upa, token) {
  upa = upa.replace(/\//g, ':')
  const payload = {
    obj_key: upa,
    show_private: true,
    show_public: true,
    offset: 0,
    result_limit: 10,
    types: false
  }
  return aqlQuery(payload, token, { view: 'wsprov_fetch_linked_objects', batch_size: 10 })
}

// Fetch all copies and linked objects of those copies from an upa
function fetchCopies (upa, token, cb) {
  const payload = {
    obj_key: upa.replace(/\//g, ':'),
    show_private: true,
    show_public: true,
    offset: 0,
    types: false,
    result_limit: 10
  }
  return aqlQuery(payload, token, { view: 'wsprov_fetch_copies', batch_size: 10 })
}

// Use the sketch service to fetch homologs (only applicable to reads, assemblies, or annotations)
// For each homolog with a kbase_id, fetch the sub-links
function fetchHomologs (upa, token) {
  const url = window._env.sketchURL
  const payload = {
    method: 'get_homologs',
    params: {
      ws_ref: upa.replace(/:/g, '/'),
      n_max_results: 100
    }
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

function fetchObj (upa, token) {
  // Fetch info about an object
  const payload = { obj_key: upa.replace(/\//g, ':') }
  return aqlQuery(payload, token, { view: 'wsprov_fetch_object' })
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
      if (json && json.results) return json.results
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
