

## Development

Start the live dev server with:

```sh
npm i
npm start
```

Point your browser to `localhost:9966`

## Build for github-pages

```
npm run build
```

## Post message API

This UI is embedded in an iframe and can receive post messages using the `JSON RPC 2.0` format.

#### Set configuration

```js
iframe.postMessage(JSON.stringify({
  method: 'setConfig',
  params: { token: 'xyz' }
}, '*')
```

#### Set the UPA (object address on KBase to search on)

```js
iframe.postMessage(JSON.stringify({
  method: 'setConfig',
  params: {
    config: {
      kbaseEndpoint: endpoint,
      authToken: token,
      upa: upa
    }
  }
}, '*'))
`

> The sketch service is a KBase dynamic service whose URL can be obtained through the "Service Wizard".

The relation engine API is at one of these URLs:

* https://kbase.us/services/relation_engine_api
* https://ci.kbase.us/services/relation_engine_api``
