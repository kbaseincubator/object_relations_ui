/*
 * Root component for the whole app
 */
import { h, Component } from "preact";

interface Props {}

interface State {}

export class App extends Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return <div>Hola mundo</div>;
  }
}
