/*
 * Root component for the whole app
 */
import { h, Component } from "preact";
// Components
import { HomologTable } from './homolog-table';
import './app.css';
import { fetchHomologs } from '../utils/fetch-homologs';
import { Env } from '../types/env';
import { HomologResult } from '../types/homologs';

interface Props {}

interface State {
  loading: boolean;
  env?: Env;
  homologs?: Array<HomologResult>;
}

export class App extends Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
    };
    window._onSetEnv = env => this.setEnv(env);
  }

  componentDidMount() {
    this.setEnv(window._env);
  }

  setEnv(env) {
    if (!env) {
      return;
    }
    this.setState({env});
    if (env.sketchURL && env.upa) {
      fetchHomologs(env.upa, env.sketchURL, env.authToken)
        .then(resp => {
          this.setState({
            homologs: resp,
            loading: false,
          });
        })
        .catch(err => {
          console.error(err);
        });
    }
  }

  render() {
    if (this.state.loading) {
      return (
        <main>
          <p><i className='fas fa-spin fa-cog'></i> Loading...</p>
        </main>
      );
    }
    return (
      <main>
        <div>
          <h2>Homologous Genomes</h2>
          <HomologTable homologs={this.state.homologs} />
        </div>
      </main>
    );
  }
}
