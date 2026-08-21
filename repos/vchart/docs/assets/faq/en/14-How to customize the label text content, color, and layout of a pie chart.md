# How to customize the label text content, color, and layout of a pie chart?

## Question Description

Can I customize the label text, color, and layout of a pie chart similar to [the one](https://www.visactor.io/vchart/demo/pie-chart/basic-pie)? What level of customization is supported and how can I configure it?

![pie chart](/vchart/faq/26-0.png)

## Solution

Different chart libraries have different levels of support for pie charts, and the level of support for pie chart labels also varies. In VChart:

- The text content of the label: You can set custom label content through the `label.formatMethod` callback function. [Please refer to the configuration document](https://www.visactor.io/vchart/option/pieChart#label.formatMethod).
- The text color of the label: You can set the style of the text, including color, font, size, etc., through `label.style`. Any attribute supported by VChart text graphics can be configured. [Please refer to the configuration document](https://www.visactor.io/vchart/option/pieChart#label.style.text).
- The layout of the label: If you simply want to adjust the position of the label, you can set `label.position` to determine whether the label is inside or outside. If you want to adjust the layout strategy, you can use label.layout for detailed adjustments. [Please refer to the configuration document for more information](https://www.visactor.io/vchart/option/pieChart#label.layout.textAlign).

## Code Example

- - Custom text content and text color.

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
    orient: 'left'
  },
  scales: [{
    id: 'labelScale',
    type: 'linear',
    domain: [{
      dataId: 'id0',
      fields: ['value']
    }],
    range: ['red', 'green'],
  }],
  label: {
    visible: true,
    formatMethod: (text, datum) => {
      return `${datum.type}: ${datum.value}`
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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

![pie chart](/vchart/faq/26-1.png)

- Custom layout, placing labels inside a pie chart.

![pie chart](/vchart/faq/26-2.png)

![pie chart](/vchart/faq/26-3.png)

## Results

[Online demo](https://codesandbox.io/s/pie-chart-label-53s2p9)

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

- [Label 文字内容配置](https://www.visactor.io/vchart/option/pieChart#label.formatMethod)
- [Label 颜色配置](https://www.visactor.io/vchart/option/pieChart#label.style.fill)
- [Label 布局配置](https://www.visactor.io/vchart/option/pieChart#label.position)
- [饼图教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Pie)
- [github](https://github.com/VisActor/VChart)
