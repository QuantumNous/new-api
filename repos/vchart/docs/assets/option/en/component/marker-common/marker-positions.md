{{ target: component-marker-point-like }}

{{ if: ${isSingle} }}

Since version 1.12.0, `position` can directly configure the callback function. The callback function needs to return the coordinate point, as follows:

```ts
/**
 * @param `seriesData` is the data of the associated series
 * @param `series` is the associated series instance
 */
position: (seriesData, series) => {
  return { x: 10, y: 30 };
};
```

{{ else }}

Since version 1.12.0, `positions` can directly configure the callback function. The callback function needs to return the coordinate point array, as follows:

```ts
/**
 * @param `seriesData` is the data of the associated series
 * @param `series` is the associated series instance
 */
positions: (seriesData, series) => {
  return [
    { x: 10, y: 30 },
    { x: 130, y: 30 }
  ];
};
```

{{/if}}

#${prefix}x(number)
x coordinate position, the number type represents the pixel value, and the string type represents the proportion relative to the canvas width or region width (from left to right).

#${prefix}y(number)
The y coordinate position, the number type represents the pixel value, and the string type represents the relative canvas height or the proportion of the region height (from top to bottom).
