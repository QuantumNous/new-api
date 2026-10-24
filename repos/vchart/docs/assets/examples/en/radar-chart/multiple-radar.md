---
category: examples
group: radar chart
title: Grouped Radar Chart
keywords: radarChart,comparison,line,circle,axis
order: 10-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/radar-chart/multiple-radar.png
option: radarChart
---

# Grouped Radar Chart

Grouped Radar Chart

## Key option

- `seriesField`: Specify the grouping field
- `axes`: Configure the two axes of the radar chart
  - Radius axis declaration: `orient: 'radius'`
  - Angle axis declaration: `orient: 'angle'`
- Smooth configuration of the radius axis grid lines: `grid.smooth: true`
- Background color configuration of the grid lines: `grid.alternateColor: '#f5f5f5'`
- `legends`: Configure the legend
  - `visible: true`: Display the legend
  - `orient: 'top'`: Legend position

## Demo source

```javascript livedemo
const mockData = [];
const types = ['A', 'B', 'C'];

types.forEach(type => {
  for (let i = 1; i <= 12; i++) {
    mockData.push({ month: i + 'th', value: Math.random() * 100 + 10, type });
  }
});

const spec = {
  type: 'radar',
  data: [
    {
      values: mockData
    }
  ],
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type',
  axes: [
    {
      orient: 'radius',
      grid: {
        smooth: true, // smooth grid lines
        style: {
          lineDash: [0]
        },
        alternateColor: '#f5f5f5' // Configure the background color between grid lines
      }
    },
    {
      orient: 'angle',
      tick: {
        visible: false
      },
      domainLine: {
        visible: true,
        style: {
          stroke: '#333'
        }
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'top'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Interval Bar Chart](link)
