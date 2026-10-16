# How to customize the image and color of a legend?

## Question Description

Can a pie chart similar to [this one](https://www.visactor.io/vchart/demo/pie-chart/basic-pie) have customizable legend icons, colors, and content? How can the customization be done?

![pie chart](/vchart/faq/27-0.png)

## Solution

The legend is a commonly used component in charts, and many types of charts support the display and configuration of legends. In VChart:

- Use the `legend.item` configuration to set a uniform style for all legend items.
- Use the `legend.data` callback function to set different content and styles for each legend item.

## Code Example

- - Use legend.item configuration to set a unified style for all legend items.

```
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left',
    item: {
      width: '15%',
      shape: {
        style: {
          background: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/log.jpeg',
          symbolType: 'rect',
          fill: false
        }
      },
      label: {
        style: {fontSize: 14, fontWeight: 'bold' }
      },
      value: {
        alignRight: true,
        style: {
          fill: '#333',
          fillOpacity: 0.8,
          fontSize: 10
        },
        state: {
          unselected: {
            fill: '#d8d8d8'
          }
        }
      }
    }
  },
  label: {
    visible: true
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};
```

![pie chart](/vchart/faq/27-1.png)

- - Use the `legend.data` callback function to set different content for each legend item.

```
const values = [
  { type: 'oxygen', value: '46.60' },
  { type: 'silicon', value: '27.72' },
  { type: 'aluminum', value: '8.13' },
  { type: 'iron', value: '5' },
  { type: 'calcium', value: '3.63' },
  { type: 'sodium', value: '2.83' },
  { type: 'potassium', value: '2.59' },
  { type: 'others', value: '3.5' }
];
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values,
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left',
    data: (items, scale,c, d) => {
      console.log(items, scale, c, d);
      return items.map(item => {
        item.value = values.find(entry => entry.type === item.label).value;
        item.shape.symbolType = 'rect';
        item.shape.background = 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/log.jpeg';
        item.shape.fill = false;
        return item;
      });
    },
    item: {
      width: '15%',
      label: {
        style: {
          fontSize: 14,
          fontWeight: 'bold'
        }
      },
      value: {
        alignRight: true,
        style: {
          fill: '#333',
          fillOpacity: 0.8,
          fontSize: 10
        },
        state: {
          unselected: {
            fill: '#d8d8d8'
          }
        }
      }
    }
  },
  label: {
    visible: true
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};
```

## Results

[Online demo](https://codesandbox.io/s/pie-chart-legend-2kzv8w)

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  scales: [
    {
      id: 'labelScale',
      type: 'linear',
      domain: [
        {
          dataId: 'id0',
          fields: ['value']
        }
      ],
      range: ['red', 'green']
    }
  ],
  label: {
    visible: true,
    formatMethod: (text, datum) => {
      return `${datum.type}: ${datum.value}`;
    },
    style: {
      fill: {
        scale: 'labelScale',
        field: 'value'
      }
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## Related Documentation

- [Legend options](https://www.visactor.io/vchart/option/pieChart-legends-discrete#type)
- [Legend tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)
- [github](https://github.com/VisActor/VChart)
