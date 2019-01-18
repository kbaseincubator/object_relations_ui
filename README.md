

## Development

Start the live dev server with:

```sh
npm i
npm start
```

Point your browser to `localhost:9968`

## Build and deploy to github-pages

```
npm run build
```

## Post message API

This UI is embedded in an iframe and can take a few post messages using `JSON RPC 2.0` format.

#### Set the KBase authentication token

```js
iframe.postMessage(JSON.stringify({
  method: 'setAuthToken',
  params: { token: 'xyz' }
}, '*')
```

#### Set the UPA (object address on KBase to search on)

```js
iframe.postMessage(JSON.stringify(P
  method: setUPA,
  params: { upa: '1/2/3' }
}, '*')
```

#### Set the relation engine API URL or the sketch service API URL

```js
iframe.postMessage(JSON.stringify({
  method: 'setSketchURL',
  params: { url: 'https://xyz' }
}), '*')
```

```js
iframe.postMessage(JSON.stringify({
  method: 'setRelEngURL',
  params: { url: 'https://xyz' }
}), '*')
```

The sketch service is a KBase dynamic service whose URL can be obtained through the "Service Wizard".

The relation engine API is at one of these URLs:
* `https://kbase.us/services/relation_engine_api`
* `https://ci.kbase.us/services/relation_engine_api`
