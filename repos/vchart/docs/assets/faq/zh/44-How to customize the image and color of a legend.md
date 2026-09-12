# 如何自定义图表中的图例的图像和颜色？

## 问题描述

类似[这样的饼图](https://www.visactor.io/vchart/demo/pie-chart/basic-pie)，图例的图像、颜色、内容可以自定义？如何自定义配置？

![pie chart](/vchart/faq/27-0.png)

## 解决方案

图例是图表中常用的组件，很多类型的图表都支持图例的展示和配置，在 VChart 中：

- 通过配置`legend.item`来对所有的图例项设置统一的样式
- 通过配置`legend.data`回调函数来对每个图例项设置不同的内容以及样式

## 代码示例

- 通过配置`legend.item`来对所有的图例项设置统一的样式

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

- 通过配置`legend.data`回调函数来对每个图例项设置不同的内容

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

## 结果展示

[在线效果参考](https://codesandbox.io/s/pie-chart-legend-2kzv8w)

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

## 相关文档

- [Legend 配置](https://www.visactor.io/vchart/option/pieChart-legends-discrete#type)
- [图例教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)
- [github](https://github.com/VisActor/VChart)
