# UI components

This app uses [snabbdom]() with a very minimalistic component system

## Create a component

Components are just collections of values and functions with a view

The view is a function that returns some snabbdom nodes

Values can be used as data in the view, while functions can update the component and re-render the view

```js
function Checkbox ({ checked }) {
  return Component({
    checked,
    toggle: (C) => { C.checked = !C.checked },
    view: (C, text) => {
      return h('fieldset', [
        h('label', text),
        h('input', {
          type: 'checkbox',
          checked: C.checked,
          on: {
            change: () => C.toggle()
          }
        })
      ])
    }
  })
}
```

You may find it a little concerning to mutate state in the functions. Lay your fears aside.

## Update state and re-render

Simply call any function in the state, and the view will re-render

```js
myComponent.myMethod(args...)
```

## Embed a child component in a parent

Child components can be saved in the parent component and used in the view.

```js
const TimeField = require('./TimeField')
const DateField = require('./DateField')
function DateTimeField ({ date, time, enabled }) {
  return Component({
    dateField: DateField({ date }),
    timeField: TimeField({ time }),
    set_val: (C, date, time) => {
      // Maybe do some formatting, validations, and conversions on date and time
      C.timeField.set(time)
      C.dateField.set(date)
    },
    view: (component) => {
      return h('fieldset', [ component.timeField, component.dateField, /* etc */ ])
    }
  })
}
```

## Render a top-level component to a page

You can access any component's plain dom node and append it to an element on the page with:

```js
document.body.appendChild(myComponent._vnode.elm)
```
