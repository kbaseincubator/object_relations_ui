export interface HomologResult {
  dist: number; // eg. 0.1
  kbase_id?: string; // eg. "1/2/3"
  namespaceid: string; // eg. "NCBI_Refseq"
  related_ids: any;
  sciname: string; // eg. "Deinococcus radiodurans R1"
  sourceid: string; // eg. "GCF_000123456.1"
  strain: string; // eg. "R1"
}
