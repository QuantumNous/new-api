# How to configure chart adaptive container width and height?

## Question Description

When I use a VChart chart, I want the chart to automatically adapt to the size of the container. What should I do?

## Solution

VChart's charts have the autoFit property, which is set to automatically fit the size of the container by default. This configuration takes precedence over the autoFit configuration in the constructor. If the user configures the width, it will be based on the user's width configuration, and the same principle applies to height.
Without any more information on your problem, I guess why the chart is not adaptive:

1. If you specify the size in spec, the container size will no longer be adaptive
2. The autoFit switch in spec is turned off
3. The size of the Dom is limited by css

In general, the first two cases are common, so you can output your final spec and check your situation.

## Code Example

```javascript
const spec = {
  type: 'common',
  autoFit:true,
  (...)
  }
```

## Quote

tooltip option: [https://visactor.io/vchart/option/barChart#autoFit](https://visactor.io/vchart/option/barChart#autoFit)

github: [https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)
