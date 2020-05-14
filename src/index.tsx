import "./index.css";
import { h, render } from "preact";
import { App } from "./components/app";

declare global {
  interface Window {
    // Global configuration
    _env: any;
    // Set the global config
    _setEnv: (any) => void;
    // Called when the global config is set
    _onSetEnv?: (any) => void;
  }
}

// Defaults
window._env = {
  sketchURL:
    "https://ci.kbase.us/dynserv/2ef8cc90ad4caf1caa86be919d326e7b3ec90435.sketch-service",
  relEngURL: "https://ci.kbase.us/services/relation_engine_api",
  rootURL: "https://ci.kbase.us",
};

// Receive JSON data in a post message
function receiveMessage(ev) {
  let data;
  if (!ev.data) {
    return;
  }
  try {
    data = JSON.parse(ev.data);
  } catch (e) {
    console.error("Unable to parse data: " + String(data));
    console.error(e);
    return;
  }
  window._setEnv(data.params.config);
}

window._setEnv = function (data) {
  window._env = Object.assign(window._env, data);
  if (window._onSetEnv) {
    window._onSetEnv(window._env);
  }
};

render(<App />, document.body);
