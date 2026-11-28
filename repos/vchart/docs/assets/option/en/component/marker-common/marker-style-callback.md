{{ target: component-marker-style-callback }}

<!-- StyleCallback -->

${description} supports callbacks. The callback function is defined as follows:

```ts
/**
 * @params
 * markerData aggregated data of the marker component
 * context marker component context includes relativeSeries, startRelativeSeries, endRelativeSeries and chart instance, supported since version 1.13.0
 * @return returns the corresponding style
 */
(markerData: DataView, context: IMarkerAttributeContext) => T;
```
