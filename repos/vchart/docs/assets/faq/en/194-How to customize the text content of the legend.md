# How to customize the text content of the legend?

## Problem Description

As shown below, how to replace the "x" in the picture with the number of product clicks?

![](/vchart/faq/91-0.png)

## solution

This corresponds to the legend part of the chart. Different chart libraries have different solutions. The configuration on VChart is introduced below. On VChart, the legend corresponds to the `legends` attribute. "x" corresponds to the label text on the legend item, which corresponds to The property is `legends.item.label`, and then we can format the displayed text through the `formatMethod` property provided by this property.

![](/vchart/faq/91-1.png)

## Code Example

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      fields: { y: { alias: '商品点击量' }, x: { alias: 'shijian' } },
      values: [
        { x: '2:00', y: 8 },
        { x: '4:00', y: 9 },
        { x: '6:00', y: 11 },
        { x: '8:00', y: 14 },
        { x: '10:00', y: 16 },
        { x: '12:00', y: 17 },
        { x: '14:00', y: 17 },
        { x: '16:00', y: 16 },
        { x: '18:00', y: 15 }
      ]
    }
  ],
  legends: {
    visible: true,
    orient: 'bottom',
    item: {
      label: {
        formatMethod: text => '商品点击量'
      }
    }
  },

  xField: 'x',
  yField: 'y'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related documents

- [Legend Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)
- [Legend configuration](https://www.visactor.io/vchart/option/lineChart#legends-discrete.type)
