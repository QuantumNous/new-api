# How to customize the shape and text style of the legend?

## Problem Description

Please tell me how to customize the shape of the legend item and modify the style of the text to achieve a legend style similar to the following figure:

![](/vchart/faq/88-0.png)

## Solution

Different chart library solutions have different solutions. The following is an introduction to how to configure using VChart. Currently, to achieve the display effect of the above figure with VChart, you need:

1. Customize data, mainly to add a numerical field to the legend item data, so that the numerical value can be displayed on the legend item, and the style of the numerical value can also be configured through the `item.value` attribute
1. In VChart, the pie chart legend shape is circular by default, but if you want to configure it into other shapes, you can configure it directly through `item.shape.style.symbolType`

![](/vchart/faq/88-1.png)

## Code Example

```javascript livedemo
const pieData = [
  {
    value: '159',
    type: 'Tradition Industries'
  },
  {
    value: '50',
    type: 'Business Companies'
  },
  {
    value: '13',
    type: 'Customer-facing Companies'
  }
];

const spec = {
  type: 'pie',
  data: [
    {
      values: pieData
    }
  ],
  categoryField: 'type',
  valueField: 'value',
  legends: {
    visible: true,
    orient: 'right',
    data: legendData => {
      const map = {};
      pieData.forEach(obj => {
        map[obj.type] = obj.value;
      });

      return legendData.map(datum => {
        datum.value = map[datum.label];
        return datum;
      });
    },
    item: {
      shape: {
        style: {
          symbolType: 'square'
        }
      },
      label: {
        style: {
          fill: '#999'
        }
      },
      value: {
        style: {
          fill: '#000',
          fontWeight: 'bold'
        },
        space: 10
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Documentation Related Documentation

- Legend tutorial: [https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)
- Legend configuration: [https://www.visactor.io/vchart/option/lineChart#legends-discrete.type](https://www.visactor.io/vchart/option/lineChart#legends-discrete.type)
