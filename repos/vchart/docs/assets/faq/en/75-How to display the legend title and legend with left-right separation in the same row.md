# How to display the legend title and legend with left-right separation in the same row?

## Question Description

I would like to add some textual descriptions to a legend, expecting to create a legend and its corresponding text description at the bottom of the chart. The desired layout effect is to have the text left-aligned and the legend right-aligned, both in the same row.
Is there any charting library that can accommodate this specific custom layout logic?

## Solution

VChart provides the legend component and title component, both have absolute positioning layout mode. By setting `layoutType: 'absolute'`, you can enable this layout mode.
Next, you can set sufficient padding for the chart and place the title component in the bottom left corner, and the legend component in the bottom right corner. This will display them into left-right separation in the same row.

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
  padding: [12, 12, 40, 12],
  legends: {
    visible: true,
    orient: 'top',
    position: 'start',
    layoutType: 'absolute',
    bottom: -40,
    right: 12,
    padding: 0
  },
  title: {
    visible: true,
    text: 'Two Series Category',
    layoutType: 'absolute',
    bottom: -40,
    left: 12,
    textStyle: {
      fontSize: 12
    },
    padding: 0
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [VChart Title API](https://visactor.io/vchart/option/barChart#title.layoutType)
- [VChart Legend API](https://visactor.io/vchart/option/barChart-legends-discrete#layoutType)
