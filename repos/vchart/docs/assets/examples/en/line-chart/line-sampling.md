---
category: examples
group: line chart
title: Line Chart Sampling
keywords: lineChart,comparison,trend,line
order: 0-12
cover: /vchart/preview/line-sampling_1.6.0.png
option: lineChart
---

# line chart sampling

Line charts, area charts, and bar charts consume a lot of redundant calculations when the amount of data is much larger than the pixel width (height) of the chart drawing area; the data sampling function provides a downsampling strategy for these situations. After using data sampling, while effectively optimizing the chart loading efficiency, the trend of the data can also be displayed as much as possible.

## Key option

- The `sampling` attribute declares the sampling algorithm
  Optional values:
  - `'lttb'`: Using the Largest-Triangle-Three-Bucket algorithm, the trend, shape and extreme value of the sampled line can be guaranteed to the greatest extent.
  - `'min'`: Get the minimum value of filter points
  - `'max'`: Take the maximum value of filter points
  - `'sum'`: Take the sum of filter points
  - `'average'`: Take the average of the filtered points

## Demo source

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/overlap-data.json');
const data = await response.json();

const spec = {
  type: 'common',
  // seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: data
    },
    {
      id: 'id1',
      values: data
    },
    {
      id: 'id2',
      values: data
    }
  ],
  series: [
    {
      type: 'line',
      id: 'no sampling',
      dataIndex: 0,
      xField: 'x',
      yField: 'y',
      point: {
        style: {
          fill: '#1664FF'
        }
      },
      line: {
        style: {
          stroke: '#1664FF'
        }
      }
    },
    {
      type: 'line',
      id: 'lttb sampling',
      dataIndex: 1,
      xField: 'x',
      yField: 'y',
      sampling: 'lttb',
      samplingFactor: 0.1,
      point: {
        style: {
          fill: '#FF8A00'
        }
      },
      line: {
        style: {
          stroke: '#FF8A00'
        }
      }
    },
    {
      type: 'line',
      id: 'average sampling',
      dataIndex: 2,
      xField: 'x',
      yField: 'y',
      sampling: 'average',
      samplingFactor: 0.1,
      point: {
        style: {
          fill: '#FFC400'
        }
      },
      line: {
        style: {
          stroke: '#FFC400'
        }
      }
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0, 1, 2, 3, 4, 5] },
    // { orient: 'right', seriesId: ['line'], grid: { visible: false } },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Line Chart](link)
