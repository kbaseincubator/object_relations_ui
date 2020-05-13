/*
 * Run stored queries on the relation engine.
 */

export async function fetchRelatedData(
  relengURL,
  upa,
  authToken: string | null = null
) {
  upa = upa.replace(/\//g, ":");
  const payload = { obj_key: upa };
  const url =
    relengURL + "/api/v1/query_results?stored_query=ws_fetch_related_data";
  const headers: any = {};
  if (authToken) {
    headers.Authorization = authToken;
  }
  const resp = await window.fetch(url, {
    method: "POST",
    headers,
    mode: "cors",
    body: JSON.stringify(payload),
  });
  const json = await resp.json();
  return json;
}
