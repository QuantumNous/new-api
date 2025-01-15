## @vue/babel-helper-vue-jsx-merge-props

A package used internally by vue jsx transformer to merge props spread. It is required to merge some prop trees like this:

```js
import mergeProps from '@vue/babel-helper-vue-jsx-merge-props'

const MyComponent = {
  render(h) {
    // original: <button onClick={$event => console.log($event)} {...{ on: { click: $event => doSomething($event) } }} />
    return h(
      'button',
      mergeProps([
        {
          on: {
            click: $event => console.log($event),
          },
        },
        {
          on: {
            click: $event => doSomething($event),
          },
        },
      ]),
    )
  },
}
```

This tool is used internally and there is no reason for you to ever use it.
