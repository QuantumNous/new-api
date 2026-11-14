# How to customize the length of the pie chart guide line?

## Question Description

When a general pie chart displays labels, an additional guide line is usually drawn to connect the sectors and the corresponding labels (similar to https://echarts.apache.org/examples/zh/editor.html?c=pie-simple). However, the common guideline logic in several chart libraries does not support configuration. What should I do if I need to customize the length of this guide line?

![pie](/vchart/faq/80-0.png)

## Solution

VChart provides a built-in layout algorithm for pie chart labels, and allows developers to customize some key configuration items in layout calculations. Developers can set the minimum length of the two leading lines through the `label.line.line1MinLength` and `label.line.line2MinLength` configuration items of the pie chart label.

For the details of the VChart pie chart label layout algorithm, please refer to this article: https://zhuanlan.zhihu.com/p/179166155

## Code Example

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
  outerRadius: 0.6,
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
  label: {
    visible: true,
    line: {
      line1MinLength: 30,
      line2MinLength: 10
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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [Pie label spec](https://visactor.io/vchart/option/pieChart#label.line.line1MinLength)
