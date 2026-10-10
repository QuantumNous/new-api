---
title: 7. How to adjust the column spacing of a bar chart</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to adjust the column spacing of a bar chart?</br>


## Description

How to adjust the column spacing of a bar chart?</br>
## Solution

The following configuration is provided on VChart for adjusting column spacing:</br>
1. In terms of `axes` configuration, the [`paddingInner`](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FbarChart-axes-band%23paddingInner(number%257Cnumber%255B%255D)) and [`paddingOuter`](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FbarChart-axes-band%23paddingOuter(number%257Cnumber%255B%255D)) properties are provided for axes of type `type: 'band'`, which are used to configure the spacing within and outside the group</br>
1. For grouped bar charts, you can also use the [`barGapInGroup`](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FbarChart%23barGapInGroup) property to adjust the bar spacing within each group in the grouped bar chart. You can set absolute pixel values or use percentages (such as' 10% ').</br>
## Code Example

### `barGapInGroup`

```
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
  barWidth: 10,
  barGapInGroup: 0
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
### `paddingInner`

```
const spec = {
  type: 'bar',
  color: ['#becef3', '#6a8edc', '#77caeb', '#52c93b', '#d3f5e8'],
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', year: '2000', value: 25 },
        { type: 'A', year: '2010', value: 28 },
        { type: 'A', year: '2018', value: 18 },
        { type: 'B', year: '2000', value: 23 },
        { type: 'B', year: '2010', value: 32 },
        { type: 'B', year: '2018', value: 22 },
        { type: 'C', year: '2000', value: 18 },
        { type: 'C', year: '2010', value: 18 },
        { type: 'C', year: '2018', value: 18 },
        { type: 'D', year: '2000', value: 15 },
        { type: 'D', year: '2010', value: 22 },
        { type: 'D', year: '2018', value: 19 },
        { type: 'E', year: '2000', value: 5 },
        { type: 'E', year: '2010', value: 12 },
        { type: 'E', year: '2018', value: 5 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  axes: [
    {
      orient: 'bottom',
      paddingInner: 0.3
    }
  ],
  bar: {
    style: {
      fillOpacity: 0.9
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## Results

*  `barGapInGroup`: https://visactor.io/vchart/demo/bar-chart/group-bar-with-barGapInGroup</br>
*  `paddingInner`: https://visactor.io/vchart/demo/bar-chart/group-bar-with-padding</br>


## Related Documents

Demo：</br>
https://visactor.io/vchart/demo/bar-chart/group-bar-with-barGapInGroup , </br>
https://visactor.io/vchart/demo/bar-chart/group-bar-with-padding</br>
API：</br>
https://visactor.io/vchart/option/barChart-axes-band#paddingInner(number%7Cnumber%5B%5D)</br>
https://visactor.io/vchart/option/barChart-axes-band#paddingOuter(number%7Cnumber%5B%5D)</br>
https://visactor.io/vchart/option/barChart#barGapInGroup</br>
github：github.com/VisActor/VChart/</br>



