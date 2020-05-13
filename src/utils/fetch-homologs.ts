// Use the sketch service to fetch similar genomes (only applicable to reads,
// assemblies, or annotations).
export async function fetchHomologs(
  upa: string,
  sketchURL: string,
  token?: string
) {
  upa = upa.replace(/:/g, "/");
  const payload = {
    method: "get_homologs",
    params: { ws_ref: upa, n_max_results: 100 },
  };
  const headers: any = {};
  if (token) {
    headers.Authorization = token;
  }
  const resp = await window.fetch(sketchURL, {
    method: "POST",
    headers,
    mode: "cors",
    body: JSON.stringify(payload),
  });
  const json = await resp.json();
  if (json.result && json.result.distances && json.result.distances.length) {
    return json.result.distances;
  } else {
    // let err: any = new Error('Unable to fetch homolog results');
    // err.json = json;
    // throw err;
    return [];
  }
  if (
    json &&
    json.result &&
    json.result.distances &&
    json.result.distances.length
  ) {
    return json.result.distances;
  }
}
