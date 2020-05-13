/*
 * Root component for the whole app
 */
import { h, Component } from "preact";
// Components
import { HomologTable } from "./homolog-table";
import "./app.css";
import { fetchHomologs } from "../utils/fetch-homologs";
import { fetchRelatedData } from "../utils/query-releng";
import { Env } from "../types/env";
import { HomologResult } from "../types/homologs";
import { RelatedData } from "../types/related-data";
import { RelatedDataTables } from "./related-data";

interface Props {}

interface State {
  loading: boolean;
  loadingHomologs: boolean;
  env?: Env;
  homologs?: Array<HomologResult>;
  // Error message loading data
  error?: string;
  relatedData?: RelatedData;
}

// Valid types that we can run the sketch service against
const HOMOLOG_TYPES = {
  "KBaseGenomes.Genome": true,
  "KBaseGenomeAnnotations.Assembly": true,
  "KBaseAssembly.PairedEndLibrary": true,
  "KBaseAssembly.SingleEndLibrary": true,
  "KBaseGenomes.ContigSet": true,
};

export class App extends Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      loadingHomologs: false,
    };
    window._onSetEnv = (env) => this.setEnv(env);
  }

  componentDidMount() {
    this.setEnv(window._env);
  }

  setEnv(env) {
    if (!env) {
      return;
    }
    this.setState({ env });
    if (env.sketchURL && env.upa) {
      this.setState({ error: undefined, loading: true });
      fetchRelatedData(env.relEngURL, env.upa)
        .then((json) => {
          const result = json.results[0];
          if (result) {
            const type =
              result.obj_type.module_name + "." + result.obj_type.type_name;
            const relatedData = {
              copies: result.copies.data,
              prov: result.prov.data,
              refs: result.refs.data,
            };
            if (type in HOMOLOG_TYPES) {
              // Load the homologs table
              this.setState({
                relatedData,
                loadingHomologs: true,
                loading: false,
              });
              return fetchHomologs(env.upa, env.sketchURL, env.authToken);
            }
            this.setState({ relatedData, loading: false });
            // No further action
            return;
          }
          throw new Error("Unable to fetch the requested object");
        })
        .then((resp) => {
          this.setState({
            homologs: resp,
            loading: false,
            loadingHomologs: false,
          });
        })
        .catch((err) => {
          this.setState({
            loading: false,
            loadingHomologs: false,
            error: String(err),
          });
        });
    }
  }

  render() {
    console.log("loadingHomologs?", this.state.loadingHomologs);
    if (this.state.error) {
      return (
        <main>
          <p>{this.state.error}</p>
        </main>
      );
    }
    if (this.state.loading) {
      return (
        <main>
          <p>
            <i className="fas fa-spin fa-cog"></i> Loading...
          </p>
        </main>
      );
    }
    return (
      <main>
        <RelatedDataTables relatedData={this.state.relatedData} />
        <HomologTable
          homologs={this.state.homologs}
          loading={this.state.loadingHomologs}
        />
      </main>
    );
  }
}
