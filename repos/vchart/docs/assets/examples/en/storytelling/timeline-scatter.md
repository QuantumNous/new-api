---
category: examples
group: storytelling
title: Dynamic Scatterplot
keywords: scatterChart,scatter,animation,player
order: 36-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/storytelling/timeline-scatter.gif
option: scatterChart
---

# Dynamic Scatterplot

## Key option

- `player` attribute configures player data and logic
  - `player.specs` attribute configures all data specs on the playback timeline
- `xField` attribute is declared as the numeric field
- `yField` attribute is declared as the categorical field
- `sizeField` attribute is declared as the size field
- `size` attribute declares the size of the visual channel mapping
  - `size.type` configures the size of the visual channel mapping type as `linear` continuous mapping
  - `size.range` configures the data range `[min, max]` to map to size `[0,30]`.
- Specify the `index` field in the data as the data key through `dataKey` for data update matching
- Configure the colors of the four quadrants through `markArea`;

## Demo source

```javascript livedemo
const yearData = {};
const firstYear = 1950;
const lastYear = 2023;

for (let year = firstYear; year <= lastYear; year++) {
  const data = [];
  yearData[year] = data;

  for (let i = 0; i < 50; i++) {
    if (year === firstYear) {
      data.push({
        x: Math.round(Math.random() * 100 - 90),
        y: Math.round(Math.random() * 100 - 90),
        value: Math.round(Math.random() * 1000),
        index: i
      });
    } else {
      const previous = yearData[year - 1][i];
      data.push({
        x: previous.x + Math.round(Math.random() * 5 - 2 + i / 50),
        y: previous.y + Math.round(Math.random() * 5 - 2 + i / 50),
        value: Math.abs(previous.value + Math.round(Math.random() * 100 - 45)),
        index: i
      });
    }
  }
}

const specs = Object.values(yearData).map((data, index) => {
  return {
    data: [
      {
        id: 'id',
        values: data
      },
      {
        id: 'year',
        values: [{ year: Object.keys(yearData)[index] }]
      }
    ]
  };
});

const DURATION = 300;

const spec = {
  type: 'common',
  player: {
    orient: 'bottom',
    auto: true,
    interval: DURATION,
    dy: 10,
    specs
  },
  data: specs[0].data,
  axes: [
    {
      orient: 'left',
      nice: true,
      zero: false,
      type: 'linear',
      range: { min: -100, max: 100 },
      tick: {
        tickCount: 10
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'bottom',
      nice: true,
      label: { visible: true },
      type: 'linear',
      range: { min: -100, max: 100 },
      tick: {
        tickCount: 10
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  series: [
    {
      type: 'scatter',
      // Data matching by index in the data
      dataKey: 'index',
      // Declare point radius size
      sizeField: 'value',
      size: {
        type: 'linear',
        range: [5, 30]
      },
      xField: 'x',
      yField: 'y',
      point: {
        style: {
          fill: '#000000',
          fillOpacity: 0.6
        }
      },
      animationAppear: {
        duration: DURATION,
        easing: 'linear'
      },
      animationUpdate: {
        duration: DURATION,
        easing: 'linear'
      }
    }
  ],
  customMark: [
    {
      type: 'text',
      dataIndex: 1,
      style: {
        text: datum => datum.year,
        x: () => 50,
        y: () => 10,
        textBaseline: 'top',
        textAlign: 'left',
        fontSize: 100,
        fontWeight: 'bolder',
        fill: 'black',
        fillOpacity: 0.2
      }
    }
  ],
  markArea: [
    {
      coordinates: [
        {
          x: -100,
          y: 0
        },
        {
          x: -100,
          y: 100
        },
        {
          x: 0,
          y: 100
        },
        {
          x: 0,
          y: 0
        }
      ],
      area: {
        style: {
          fill: '#E69151',
          fillOpacity: 0.5
        }
      }
    },
    {
      coordinates: [
        {
          x: 0,
          y: 100
        },
        {
          x: 0,
          y: 0
        },
        {
          x: 100,
          y: 0
        },
        {
          x: 100,
          y: 100
        }
      ],
      area: {
        style: {
          fill: '#EACC4E',
          fillOpacity: 0.5
        }
      }
    },
    {
      coordinates: [
        {
          x: -100,
          y: -100
        },
        {
          x: -100,
          y: 0
        },
        {
          x: 0,
          y: 0
        },
        {
          x: 0,
          y: -100
        }
      ],
      area: {
        style: {
          fill: '#9DD5DD',
          fillOpacity: 0.5
        }
      }
    },
    {
      coordinates: [
        {
          x: 0,
          y: 0
        },
        {
          x: 0,
          y: -100
        },
        {
          x: 100,
          y: -100
        },
        {
          x: 100,
          y: 0
        }
      ],
      area: {
        style: {
          fill: '#5DB9BF',
          fillOpacity: 0.5
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related tutorial

[Bar chart](link)
