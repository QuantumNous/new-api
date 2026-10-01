{{ target: component-common-style-callback }}

<!-- StyleCallback -->

${description} supports callback, and the definition of the callback function is as follows:

{{ if: ${componentType} === 'discrete-legend' }}

```ts
/**
 * @params item legend item data
 * @params isSelected whether selected
 * @params index index
 * @params allItems full legend item data
 * @return returns the corresponding style
 */
(item: LegendItemDatum, isSelected: boolean, index: number, allItems: LegendItemDatum[]) => T;
```

{{ else }}

```ts
/** 
 * @params value The value corresponding to the current element * @params value The value corresponding to the current element
 * @params index index value * @params index index value
 * @params datum The data carried by the current element * @params datum The data carried by the current element
 * @params data full data
 * @return returns the corresponding style * @return returns the corresponding style
 */
(value: any, index: number, datum: Datum) => Object; (value: any, index: number, datum: Datum, data: Datum[]) => Object;
```

{{ /if }}