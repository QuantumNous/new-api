---
category: examples
group: customMark
title: Custom State Sorting
order: 40-0
cover: /vchart/preview/custom-state-sort_1.9.0.gif
option: lineChart#customMark
---

# Custom State Sorting

## Key Configuration

- `stateSort` customizes the order of states, ensuring that user-defined states always take precedence over the internal `dimension_hover` state display.

## Code Demo

```javascript livedemo
const stateMap = {
  dimension_hover: 1,
  unHover_line: 10,
  hover_line: 20
};
const spec = {
  type: 'line',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'WY',
          Age: 'Under 5 Years',
          Population: 25635
        },
        {
          State: 'WY',
          Age: '5 to 13 Years',
          Population: 1890
        },
        {
          State: 'WY',
          Age: '14 to 17 Years',
          Population: 9314
        },
        {
          State: 'DC',
          Age: 'Under 5 Years',
          Population: 30352
        },
        {
          State: 'DC',
          Age: '5 to 13 Years',
          Population: 20439
        },
        {
          State: 'DC',
          Age: '14 to 17 Years',
          Population: 10225
        },
        {
          State: 'VT',
          Age: 'Under 5 Years',
          Population: 38253
        },
        {
          State: 'VT',
          Age: '5 to 13 Years',
          Population: 42538
        },
        {
          State: 'VT',
          Age: '14 to 17 Years',
          Population: 15757
        },
        {
          State: 'ND',
          Age: 'Under 5 Years',
          Population: 51896
        },
        {
          State: 'ND',
          Age: '5 to 13 Years',
          Population: 67358
        },
        {
          State: 'ND',
          Age: '14 to 17 Years',
          Population: 18794
        },
        {
          State: 'AK',
          Age: 'Under 5 Years',
          Population: 72083
        },
        {
          State: 'AK',
          Age: '5 to 13 Years',
          Population: 85640
        },
        {
          State: 'AK',
          Age: '14 to 17 Years',
          Population: 22153
        }
      ]
    }
  ],
  xField: 'State',
  yField: 'Population',
  seriesField: 'Age',
  legends: {
    visible: true
  },
  point: {
    style: {
      size: 0,
      fill: 'white',
      stroke: null,
      lineWidth: 2
    },
    stateSort: (stateA, stateB) => {
      return stateMap[stateA] - stateMap[stateB];
    },
    state: {
      dimension_hover: {
        size: 8
      },

      unHover_line: {
        size: 0
      }
    }
  },
  line: {
    style: {
      lineWidth: 5
    },
    state: {
      hover_line: {
        strokeOpacity: 1
      },
      unHover_line: {
        strokeOpacity: 0.1
      }
    }
  },
  crosshair: {
    xField: {
      line: {
        type: 'line'
      }
    }
  },
  tooltip: false
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

vchart.on('pointerover', { level: 'mark' }, ({ datum, mark }) => {
  if (mark && mark.name === 'line' && datum && datum.length) {
    const series = datum[0].Age;
    vchart.updateState({
      hover_line: {
        filter: datum => {
          const data = Array.isArray(datum) ? datum[0] : datum;
          return data.Age === series;
        }
      },
      unHover_line: {
        filter: datum => {
          const data = Array.isArray(datum) ? datum[0] : datum;
          return data.Age !== series;
        }
      }
    });
  }
});

vchart.on('pointerout', { level: 'mark' }, ({ datum, mark }) => {
  if (mark && mark.name === 'line' && datum && datum.length) {
    const series = datum[0].Age;
    vchart.updateState({
      hover_line: {
        filter: () => false
      },
      unHover_line: {
        filter: () => false
      }
    });
  }
});

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
