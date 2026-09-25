# How to control the display order of stacking and legends and add display of total information on the tooltip

## Problem Description

![](/vchart/faq/85-0.png)

For the stacked area chart, I want to control the order of stacking. For example, I want the area chart to be stacked in the order of "China", "USA", "EU", "Africa" from bottom to top, and then the display order of the legend also follows " China", "USA", "EU", "Africa" are displayed in order from left to right, and when hovering up, the tooltip can display the total information, as shown in the following figure:

![](/vchart/faq/85-1.png)

## solution

This can be configured very simply on [VChart](https://www.visactor.io/vchart/), which only requires two steps:

1. Control the stacking order by configuring `domain` and `sortIndex` for the grouping field on the `data.fields` property
   - `domain` to declare the order
   - `sortIndex` declared as 0 means sorting in `domain` order

![](/vchart/faq/85-2.png)

Because the order of the legend is displayed in the order of field domain declaration by default, the legend does not need to be configured here.

2. By configuring `updateContent` for `tooltip.dimension`, you can dynamically add the required information to the tooltip content, and you can also get all the information displayed by the current tooltip.

![](/vchart/faq/85-3.png)

## Code Example

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    fields: {
      country: {
        domain: ['China', 'USA', 'EU', 'Africa'],
        sortIndex: 0
      }
    },
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: 'Stacked area chart of cosmetic products sales'
  },
  stack: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  tooltip: {
    dimension: {
      updateContent: data => {
        let sum = 0;
        data.forEach(datum => {
          sum += +datum.value;
        });
        data.push({
          hasShape: 'false',
          key: 'Total',
          value: sum
        });
        return data;
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Result display

Online effect reference: [https://codepen.io/Sima/pen/WNLxdyg](https://codepen.io/Sima/pen/WNLxdyg)

## Related documents

Stacked area chart demo: [https://www.visactor.io/vchart/demo/area-chart/stacked-area](https://www.visactor.io/vchart/demo/area-chart/stacked-area)

Area chart tutorial: [https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Area](https://www.visactor.io/vchart/demo/area-chart/stacked-area)

Data configuration tutorial: [https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Data/Data_Types_and_Interface](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Data/Data_Types_and_Interface)

Tooltip configuration tutorial: [https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip)

Data field configuration: [https://www.visactor.io/vchart/option/areaChart#data(IDataType%7CIDataType%5B%5D).IDataValues.fields](<https://www.visactor.io/vchart/ option/areaChart#data(IDataType%7CIDataType%5B%5D).IDataValues.fields>)

Tooltip configuration item: [https://www.visactor.io/vchart/option/areaChart#tooltip.visible](https://www.visactor.io/vchart/option/areaChart#tooltip.visible)

github: [https://github.com/VisActor/VChart](https://www.visactor.io/vchart/option/areaChart#tooltip.visible)
