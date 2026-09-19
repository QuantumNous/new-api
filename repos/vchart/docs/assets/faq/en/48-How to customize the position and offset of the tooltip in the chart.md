# How to customize the position and offset of the tooltip in the chart?

## Question Description

When I use VChart charts, I encounter the problem that the chart tip box is very close to the mouse pointer, so that the mouse pointer may obscure the tips on a large screen with high resolution. Is there any way to solve this problem?

![tooltip](/vchart/faq/41-0.png)

## Solution

VChart already provides the corresponding function, you just need to set tooltip.offset in the spec of the chart. The corresponding configuration documents are available on the official website.

[https://visactor.io/vchart/option/barChart#tooltip.offset](https://visactor.io/vchart/option/barChart#tooltip.offset)

## Code Example

```javascript
spec.tooltip.offset = {
  x: 40,
  y: 40
};
```

## Result

![demo](/vchart/faq/41-1.png)

Demo: [https://codesandbox.io/s/tooltip-offset-mns4gl?file=/src/index.ts](https://codesandbox.io/s/tooltip-offset-mns4gl?file=/src/index.ts)

## Quote

tooltip option：[https://visactor.io/vchart/option/barChart#tooltip.offset](https://visactor.io/vchart/option/barChart#tooltip.offset)

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)

Tooltip tutorials: [https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip)

Tooltip demos:[https://www.visactor.io/vchart/demo/tooltip/custom-mark-tooltip](https://www.visactor.io/vchart/demo/tooltip/custom-mark-tooltip)
