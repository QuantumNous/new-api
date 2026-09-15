# How to combine percentage bar and TGI chart?

## Question Description

I would like to use a front-end chart library to implement a combination of percentage bar chart and TGI chart.

The TGI chart uses vertical bars to represent TGI values and connects different bars with lines. As the two charts use different axes, how can we implement this?

## Solution

You can use @VisActor/VChart to achieve the desired effect. VChart allows multiple series to be combined in one chart. You only need to set the chart type to "common" and add bar chart and line chart series in the series. Modify the line style of the line chart to dashed line and the point style to rectangle to achieve the effect in the figure. In order to use different coordinate axes for the bar chart and line chart, three coordinate axes need to be configured in the "axes": a left band axis, a bottom linear axis for the line chart, and a linear axis for the bar chart. You can place the bar chart axis at the top and set "visible" to false. By adjusting the "max" property, you can specify the range of the axis to achieve the effect in the figure.

## Code Example

The spec is as follows:

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'data',
      values: [
        { x: '2015-09-24', y: 0.6 },
        { x: '2015-09-25', y: 0.7 },
        { x: '2015-09-26', y: 0.71 },
        { x: '2015-09-27', y: 0.65 },
        { x: '2015-09-28', y: 0.53 },
        { x: '2015-09-29', y: 0.55 }
      ]
    },
    {
      id: 'data2',
      values: [
        { x: '2015-09-24', y: 40 },
        { x: '2015-09-25', y: 25 },
        { x: '2015-09-26', y: 31 },
        { x: '2015-09-27', y: 37 },
        { x: '2015-09-28', y: 28 },
        { x: '2015-09-29', y: 22 }
      ]
    }
  ],

  series: [
    {
      type: 'bar',
      id: 'barSeries',
      direction: 'horizontal',
      dataId: 'data',
      yField: 'x',
      xField: 'y'
    },
    {
      type: 'line',
      id: 'lineSeries',
      direction: 'horizontal',
      dataId: 'data2',
      yField: 'x',
      xField: 'y',
      line: {
        style: {
          lineDash: [2, 5]
        }
      },

      point: {
        style: {
          symbolType: 'rect',
          size: 10,
          scaleX: 1,
          scaleY: 10
        }
      }
    }
  ],
  axes: [
    {
      orient: 'left',
      seriesId: ['barSeries', 'lineSeries'],
      type: 'band',
      grid: {
        visible: true
      }
    },
    {
      orient: 'top',
      type: 'linear',
      max: 1.2,
      seriesId: ['barSeries'],
      grid: {
        visible: true
      },
      visible: false
    },
    {
      orient: 'bottom',
      type: 'linear',
      seriesId: ['lineSeries'],

      grid: {
        visible: true
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Results

- [Online Demo](https://codesandbox.io/s/bar-chart-and-tgi-chart-8fkprk?file=/src/index.ts)

## Quote

- [VChart Combination Chart Tutorial](https://visactor.io/vchart/guide/tutorial_docs/Chart_Types/Combination)
- [Related API](https://visactor.io/vchart/option/commonChart#type)
- [github](https://github.com/VisActor/VChart)
