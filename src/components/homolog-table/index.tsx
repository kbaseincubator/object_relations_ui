/*
 * Mash search table for a given genome or assembly.
 */
import { h, Component } from "preact";
import { HomologResult } from "../../types/homologs";

interface Props {
  homologs: Array<HomologResult>;
}
interface State {}

export class HomologTable extends Component<Props, State> {

  render() {
    return (
      <table>
        <thead>
          <tr>
            <th>ANI Distance</th>
            <th>Name</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {this.props.homologs.map(hom => renderRow(hom))}
        </tbody>
      </table>
    );
  }
}

function renderRow(homolog: HomologResult) {
  const ncbiHref = 'https://www.ncbi.nlm.nih.gov/assembly/' + homolog.sourceid;
  let sciname: any = homolog.sciname;
  if (homolog.kbase_id) {
    const href = window._env.kbaseRoot + '/#dataview/' + homolog.kbase_id;
    sciname = (
      <a href={href}>
        {homolog.sciname}
      </a>
    );
  }
  return (
    <tr>
      <td>{homolog.dist}</td>
      <td> {sciname} </td>
      <td>
        <a href={ncbiHref} target='_blank'>
          <i className='fas fa-external-link-alt'></i>{' '}
          {formatNamespace(homolog.namespaceid)}
        </a>
      </td>
    </tr>
  );
}

function formatNamespace(ns) {
  return ns.replace(/_/g, ' ');
}
