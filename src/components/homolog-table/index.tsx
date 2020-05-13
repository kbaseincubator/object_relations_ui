/*
 * Mash search table for a given genome or assembly.
 */
import { h, Component } from "preact";
import { HomologResult } from "../../types/homologs";

interface Props {
  homologs: Array<HomologResult>;
  loading?: boolean;
}
interface State {}

export class HomologTable extends Component<Props, State> {
  render() {
    if (this.props.loading) {
      return (
        <div>
          <p>
            <i className="fas fa-spin fa-cog"></i> Searching for homologous
            genomes...
          </p>
        </div>
      );
    }
    if (!this.props.homologs || !this.props.homologs.length) {
      return "";
    }
    return (
      <div>
        <h2>Homologous Genomes</h2>
        <table>
          <thead>
            <tr>
              <th>ANI Distance</th>
              <th>Name</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>{this.props.homologs.map((hom) => renderRow(hom))}</tbody>
        </table>
      </div>
    );
  }
}

function renderRow(homolog: HomologResult) {
  const ncbiHref = "https://www.ncbi.nlm.nih.gov/assembly/" + homolog.sourceid;
  let sciname: any = homolog.sciname || homolog.sourceid;
  if (homolog.kbase_id) {
    const href = window._env.kbaseRoot + "/#dataview/" + homolog.kbase_id;
    sciname = <a href={href}>{homolog.sciname || homolog.sourceid}</a>;
  }
  return (
    <tr>
      <td>{homolog.dist}</td>
      <td> {sciname} </td>
      <td>
        <a href={ncbiHref} target="_blank">
          <i className="fas fa-external-link-alt"></i>{" "}
          {formatNamespace(homolog.namespaceid)}
        </a>
      </td>
    </tr>
  );
}

function formatNamespace(ns) {
  return ns.replace(/_/g, " ");
}
