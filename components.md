# UI components

This app uses [snabbdom](https://github.com/snabbdom/snabbdom) with a very minimalistic component system

## Create a component

Components are just collections of values and functions with a view.

The view is a function that returns some snabbdom nodes.

Values can be used as data in the view, while functions can update the component and re-render the view.

```js
function Checkbox ({ checked }) {
  return Component({
    checked,
    toggle () {
      this.checked = !this.checked
      this._render()
    },
    view (text) {
      return h('fieldset', [
        h('label', text),
        h('input', {
          props: {
            type: 'checkbox',
            checked: this.checked,
          },
          on: { change: () => this.toggle() }
        })
      ])
    }
  })
}
```

## Update state and re-render

After changing some state for a component, call `component._render()` to update it in the DOM.

## Embed a child component in a parent

Child components can be saved in the parent component and used in the view.

```js
const TimeField = require('./TimeField')
const DateField = require('./DateField')
function DateTimeField ({ date, time, enabled }) {
  return Component({
    dateField: DateField({ date }),
    timeField: TimeField({ time }),
    set_val: (date, time) => {
      // Maybe do some formatting, validations, and conversions on date and time
      this.timeField.set(time)
      this.dateField.set(date)
      this._render()
    },
    view: () => {
      return h('fieldset', [ this.timeField.view(), this.dateField.view(), /* etc */ ])
    }
  })
}
```

## Render a top-level component to a page

You can access any component's plain dom node and append it to an element on the page with:

```js
document.body.appendChild(MyComponent().view().elm)
```
