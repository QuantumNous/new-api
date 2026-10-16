{{ target: component-marker-data-point-offset }}

{{ if: ${isSingle} }}

#${prefix} coordinatesOffset(object)

{{ else }}

#${prefix} coordinatesOffset(object[])

{{/if}}

Since `1.7.3` version, it only takes effect when `coordinates` is used for positioning. It is used to offset the converted canvas coordinate point of each data point. The offset value can be a pixel value or String type, such as '20%' represents a percentage, corresponding to the order of `coordinates`.（only supported in cartesian coordinate system）

Example:

{{ if: ${isSingle} }}

```ts
{
   coordinates: { type: 'Autocracies', year: '1930', value: 129 },
   coordinatesOffset: { x: -5, y: 0 },
}
```

{{ else }}

```ts
{
   coordinates: [
     { type: 'Autocracies', year: '1930', value: 129 },
     { type: 'Autocracies', year: '2000', value: 89 }
   ],
   coordinatesOffset: [
     { x: 0, y: 0 },
     { x: -5, y: 0 }
   ],
}
```

{{/if}}
