
// Results from the graph query on RE
export interface RelatedData {
  copies: Array<RelatedDataResult>;
  prov: Array<RelatedDataResult>;
  refs: Array<RelatedDataResult>;
}

export interface RelatedDataResult {
  // How many hops across edges to get to this vertex
  hops: number;
  data: RelatedDataObj;
  type: RelatedDataType;
}

export interface RelatedDataObj {
  object_id: number;
  workspace_id: number;
  version: number;
  name: string;
  epoch: number;
  _key: string;
}

export interface RelatedDataType {
  maj_ver: number;
  min_ver: number;
  module_name: string;
  type_name: string;
  _key: string;
}
