# How to customize Tooltip in dual axis chart?

## Question Description

How to display some rich text content in the tooltip of the dual axis chart?

![tooltip](/vchart/faq/40-0.png)

## Solution

This question presupposes a dual-axis chart. In fact, for most chart components with tooltips customization, whether or not it's a dual-axis chart has no effect on customizing the tooltips.
Next I'll use an example of a VisActor chart that I've been using recently, and the logic goes something like this:

- Determine the type of tooltips you want to customize.
- Register an event to trigger the display of custom tooltips.
- Design your own layout for the tooltip
  In custom events, you can render the tooltip any way you want. By callback event parameters, you can get the current hover element specific data.

## Code Example

```javascript
const vchart = new VChart(spec, { dom: 'container' });

vchart.setTooltipHandler({
  showTooltip: (activeType, tooltipData, params) => {
    // some code of custom tooltip
    const tooltip = document.getElementById('custom-tooltip');
    if (!tooltip) return;
    tooltip.style.visibility = 'visible';
    tooltip.style.left = params.event.x + 20 + 'px';
    tooltip.style.top = params.event.y + 20 + 'px';
    tooltip.style.position = 'absolute';
    tooltip.style.background = 'white';
    tooltip.style.padding = '10px';
    tooltip.innerText = 'This is Custom Tooltip';
  },
  hideTooltip: () => {
    // hide your custom tooltip
    const tooltip = document.getElementById('custom-tooltip');
    if (!tooltip) return;
    tooltip.style.visibility = 'hidden';
  }
});
```

## Result

![result](/vchart/faq/40-1.png)

[https://codesandbox.io/s/custom-tooltip-dyvy3z](https://codesandbox.io/s/custom-tooltip-dyvy3z)

## Quote

- [https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip)
- [https://visactor.io/vchart/demo/tooltip/custom-tooltip-handler?keyword=tooltip](https://visactor.io/vchart/demo/tooltip/custom-tooltip-handler?keyword=tooltip)
