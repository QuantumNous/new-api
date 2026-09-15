# How do I customize the position of the tooltip to avoid occlusion?

## Question Description

When I use VChart charts, the tooltip of the chart gets truncated by the edge of the dom. I would like to know how to customize the position of the tooltip in VChart to avoid this？

![tooltip](/vchart/faq/43-0.png)

## Solution

There are many ways to control the position of tooltip in VChart, such as implementing a custom tooltip, or specifying the offset parameter of tooltip.
But there is actually a simple way to realize the situation you encountered, by specifying the dom node where the tooltip is mounted.
By default, the tooltip is mounted on the body of the page, so it is not supposed to be truncated. In your case you may have modified the `spec.tooltip.parentElement` configuration. Removing or modifying that configuration should solve your problem.

## Code Example

```javascript
spec.tooltip.parentElement = document.body;
```

## Result

![demo](/vchart/faq/43-1.png)

Demo: [https://visactor.io/vchart/demo/line-chart/null-value-line](https://visactor.io/vchart/demo/line-chart/null-value-line)

## Quote

tooltip: [https://visactor.io/vchart/option/barChart#tooltip.parentElement](https://visactor.io/vchart/option/barChart#tooltip.parentElement)

github: [https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)

Tooltip tutorials: [https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip)
