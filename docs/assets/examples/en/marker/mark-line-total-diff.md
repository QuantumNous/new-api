---
category: examples
group: marker
title: Total-Diff markLine
keywords: marker,barChart
order: 33-9
cover: /vchart/preview/mark-line-total-diff_1.7.0.png
option: barChart#markLine
---

# Total difference markLine

Using the `'type-step'` type annotation of `markLine`, a total difference annotation can be drawn.

## Key configuration

- Declare the `markLine` attribute
- configure `type: 'type-step'`
- Configure data points: `coordinates`

## Demo source

```javascript livedemo
const markLineSpec = {
  connectDirection: 'top',
  expandDistance: 30,
  line: {
    style: {
      lineDash: [0],
      lineWidth: 2,
      stroke: '#000',
      cornerRadius: 4
    }
  },
  label: {
    position: 'middle',
    labelBackground: {
      padding: { left: 4, right: 4, top: 4, bottom: 4 },
      style: {
        fill: '#fff',
        fillOpacity: 1,
        stroke: '#000',
        lineWidth: 1,
        cornerRadius: 4
      }
    },
    style: {
      fill: '#000'
    }
  },
  endSymbol: {
    size: 12,
    refX: -4
  }
};

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
      type: 'type-step',
      coordinates: [
        { type: 'Autocracies', year: '1930', value: 129 },
        { type: 'Autocracies', year: '2000', value: 89 }
      ],
      coordinatesOffset: [
        { x: 0, y: 0 },
        { x: -5, y: 0 }
      ],
      ...markLineSpec,
      label: {
        ...markLineSpec.label,
        text: `${(((89 - 129) / 89) * 100).toFixed(0)}%`
      }
    },
    {
      type: 'type-step',
      coordinates: [
        { type: 'Autocracies', year: '2000', value: 89 },
        { type: 'Autocracies', year: '2018', value: 80 }
      ],
      coordinatesOffset: [
        { x: 5, y: 0 },
        { x: 0, y: 0 }
      ],
      ...markLineSpec,
      label: {
        ...markLineSpec.label,
        text: `${(((89 - 129) / 89) * 100).toFixed(0)}%`
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
