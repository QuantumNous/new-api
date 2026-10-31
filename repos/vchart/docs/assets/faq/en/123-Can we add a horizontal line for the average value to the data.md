# Can we add a horizontal line for the average value to the data?

## Question Description

When using the VChart chart library, can you achieve an effect similar to the figure below, adding a label line to the chart to represent the average value of the data?
[markline average](/vchart/faq/7-0.png)

## Solution

VChart has rich data annotation capabilities. For the scenario you described, you only need to configure `x: 'average'` in markLine.

## Code Example

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Autocracies', year: '1930', value: 129 },
        { type: 'Autocracies', year: '1940', value: 133 },
        { type: 'Autocracies', year: '1950', value: 130 },
        { type: 'Autocracies', year: '1960', value: 126 },
        { type: 'Autocracies', year: '1970', value: 117 },
        { type: 'Autocracies', year: '1980', value: 114 },
        { type: 'Autocracies', year: '1990', value: 111 },
        { type: 'Autocracies', year: '2000', value: 89 },
        { type: 'Autocracies', year: '2010', value: 80 },
        { type: 'Autocracies', year: '2018', value: 80 },
        { type: 'Democracies', year: '1930', value: 22 },
        { type: 'Democracies', year: '1940', value: 13 },
        { type: 'Democracies', year: '1950', value: 25 },
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
    orient: 'top',
    position: 'start'
  },
  markLine: [
    {
      y: 'average',
      label: {
        visible: true,
        position: 'insideEndTop',
        text: 'Average Country',
        style: {
          fill: '#000'
        },
        labelBackground: {
          visible: false
        }
      }
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

window['vchart'] = vchart;
```

## Quote

- [Chart Annotation Demo](https://visactor.io/vchart/demo/marker/mark-line-axis)
- [Chart Annotation Tutorials](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/marker)
- [Related api](https://visactor.io/vchart/option/barChart#markLine.y)
- [github](https://github.com/VisActor/VChart)
