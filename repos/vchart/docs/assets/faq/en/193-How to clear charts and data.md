# How to clear charts and data?

## Problem Description

Is there an API that can clear a rendered chart? Expect to clear the graphics in the chart, but keep components such as axes.

## solution

In VChart, if you want to clear the entire chart, you can directly call the `release` method of the chart instance. If you want to clear only the graph of the chart but keep components such as the axis, you can use the `updateData` method to set the data to empty, as follows:

```ts
// Assume your data id is 'data'
vchart.updateData('data', []);
```

## Result display

Online effect reference: [https://codesandbox.io/s/clear-mark-4s75yy](https://codesandbox.io/s/clear-mark-4s75yy)

## Related documents

- [Chart API](https://www.visactor.io/vchart/api/API/vchart)

* [github](https://github.com/VisActor/VChart)
