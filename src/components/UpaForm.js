const serialize = require('form-serialize')
const h = require('snabbdom/h').default
const Component = require('./Component')
import { Button } from './views/button'

// Form for manually submitting auth/endpoint/upa


export function UpaForm () {
  let data = {
    kbaseEndpoint: window._env.kbaseEndpoint,
    authToken: window._env.authToken
  }
  if (document.location.search === '?form' && window.localStorage.upaFormData) {
    try {
      data = JSON.parse(window.localStorage.upaFormData)
    } catch (e) {
      console.error('Error loading upaFormData', e)
      window.localStorage.removeItem('upaFormData')
    }
  }
  return Component({ data, view })
}

function view () {
  const upaForm = this
  // Only show when ?form is in the url
  if (document.location.search !== '?form') return h('div')
  return h('form.mb3', {
    on: {
      submit: ev => {
        ev.preventDefault()
        const formData = serialize(ev.currentTarget, { hash: true })
        window.localStorage.upaFormData = JSON.stringify(formData)
        window._messageHandlers.setConfig({ config: formData })
        upaForm.data = formData
        // TODO newSearch(state, actions, state.upa)
      }
    }
  }, [
    fieldset([
      label('KBase endpoint'),
      h('input.input.p1', {
        props: {
          required: true,
          type: 'text',
          name: 'kbaseEndpoint',
          value: upaForm.data.kbaseEndpoint
        }
      })
    ]),
    fieldset([
      label('Auth token'),
      h('input.input.p1', {
        props: {
          type: 'password',
          name: 'authToken',
          value: upaForm.data.authToken
        }
      })
    ]),
    fieldset([
      label('Object address'),
      h('input.input.p1', {
        props: {
          placeholder: '1/2/3',
          required: true,
          type: 'text',
          name: 'upa',
          value: upaForm.data.upa
        }
      })
    ]),
    fieldset([ Button('Submit') ])
  ])
}

function label (txt) {
  return h('label.black-60.mb2.bold.db', txt)
}

function fieldset (children) {
  return h('fieldset.clearfix.pv2.ph0.bn.dib', children)
}
