# How to customize the theme for a chart, such as in VChart?

## Question Description

Similar to [the chart](https://www.visactor.io/vchart/demo/pie-chart/basic-pie), how can I switch themes with just one click? What is the cost?

![pie chart](/vchart/faq/28-0.png)

## Solution

Different chart libraries have different approaches to theme switching. VChart supports theme switching, and you can refer to the official documentation for detailed configuration:

- [Theme tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Theme/Theme)
- [Color theme tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Theme/Color_Theme)
- [Custom theme tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Theme/Customize_Theme)

## Code Example

```
const theme = {
  colorScheme: {
    default: [
      "#fff5f0",
      "#fee0d2",
      "#fcbba1",
      "#fc9272",
      "#fb6a4a",
      "#ef3b2c",
      "#cb181d",
      "#a50f15",
      "#67000d"
    ]
  },
  series: {
    pie: {
      label: {
        position: 'inside'
      }
    }
  },
  component: {
    discreteLegend: {
      visible: true,
      orient: 'top'
    }
  }
};

const spec = {
  type: 'pie',
  theme,
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
  label: { visible: true },
  // legends: { visible: true },
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

[Online demo](https://codesandbox.io/s/pie-chart-theme-rk8ft5)

```javascript livedemo
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

const theme = {
  colorScheme: {
    default: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d']
  },
  series: {
    pie: {
      label: {
        position: 'inside'
      }
    }
  },
  component: {
    discreteLegend: {
      visible: true,
      orient: 'top'
    }
  }
};

const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values
    }
  ],
  theme,
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true
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

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## Related Documentation

- [Theme tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Theme/Theme)
- [Color theme tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Theme/Color_Theme)
- [Customized theme tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Theme/Customize_Theme)
- [github](https://github.com/VisActor/VChart)
