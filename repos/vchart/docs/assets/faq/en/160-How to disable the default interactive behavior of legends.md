# How to disable the default interactive behavior of legends?

## Question Description

When displaying charts on the mobile end, in order to facilitate user reading, the legend size of the chart will be expanded. But almost every chart library's legend component defaults to setting default interactive behavior for the legend, such as filtering data when clicked.

How to cancel the default interaction of the legend in the chart, which is prone to accidentally touching it when sliding your fingers?

## Solution

VChart provides interactive configurations for interactive marks or components to control whether `interactive` features are enabled or disabled, such as legends, chart annotations, various types of elements, etc.
Although this configuration is enabled by default, users can control the interactive behavior of the chart themselves.

## Code Example

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Autocracies', year: '1960', value: 126 },
        { type: 'Autocracies', year: '1970', value: 117 },
        { type: 'Autocracies', year: '1980', value: 114 },
        { type: 'Autocracies', year: '1990', value: 111 },
        { type: 'Autocracies', year: '2000', value: 89 },
        { type: 'Autocracies', year: '2010', value: 80 },
        { type: 'Autocracies', year: '2018', value: 80 },
        { type: 'Democracies', year: '1960', value: 29 },
        { type: 'Democracies', year: '1970', value: 38 },
        { type: 'Democracies', year: '1980', value: 41 },
        { type: 'Democracies', year: '1990', value: 57 },
        { type: 'Democracies', year: '2000', value: 87 },
        { type: 'Democracies', year: '2010', value: 98 },
        { type: 'Democracies', year: '2018', value: 99 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  legends: {
    visible: true,
    orient: 'bottom',
    position: 'middle',
    interactive: false
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [VChart Legend Guide](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)
- [VChart Legend API](https://visactor.io/vchart/option/barChart-legends-discrete#interactive)
