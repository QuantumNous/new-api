{{ target: graphic-stroke-style }}

{{ use: graphic-partial-stroke-style(
prefix = ${prefix},
markType = ${markType}
) }}

#${prefix} outerBorder(Object)

Outer border configuration.

Example:

```ts
outerBorder: {
  distance: 2,
  lineWidth: 1,
  stroke: 'green'
},
```

{{ use: border-style(
prefix = '#' + ${prefix}
) }}

#${prefix} innerBorder(Object)

Inner border configuration.

Example:

```ts
innerBorder: {
  distance: 2,
  lineWidth: 1,
  stroke: 'green'
},
```

{{ use: border-style(
prefix = '#' + ${prefix}
) }}
