/*
 * Tables of related data based on all the edges we can traverse on RE for an
 * object
 */
import { h, Component } from "preact";
import { RelatedData } from "../../types/related-data";

interface Props {
  relatedData: RelatedData;
}
interface State {}

export class RelatedDataTables extends Component<Props, State> {
  render() {
    if (!this.props.relatedData) {
      return "";
    }
    return (
      <div>
        {renderTable(this, "copies", "Copies")}
        {renderTable(this, "refs", "References")}
        {renderTable(this, "prov", "Provenance")}
      </div>
    );
  }
}

function renderTable(table, prop, title) {
  const rows = table.props.relatedData[prop];
  if (!rows || !rows.length) {
    return "";
  }
  return (
    <div>
      <h2>{title}</h2>
      <table>
        <thead>
          <th>Type</th>
          <th>Name</th>
          <th>Creator</th>
          <th>Date</th>
          <th>Hops</th>
        </thead>
        <tbody>{rows.slice(0, 10).map((row) => renderRow(row))}</tbody>
      </table>
    </div>
  );
}

function renderRow(row) {
  const obj = row.data;
  const type = row.type;
  const objHref =
    window._env.kbaseRoot + "/#dataview/" + obj._key.replace(/:/g, "/");
  return (
    <tr>
      <td>{type.module_name + "." + type.type_name}</td>
      <td>
        <a href={objHref}>{obj.name}</a>
      </td>
      <td>TODO</td>
      <td>{new Date(obj.epoch).toLocaleDateString()}</td>
      <td>{row.hops}</td>
    </tr>
  );
}
