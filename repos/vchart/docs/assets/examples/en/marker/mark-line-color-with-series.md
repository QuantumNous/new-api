---
category: examples
group: marker
title: markLine
keywords: marker,lineChart
order: 33-26
cover: /vchart/preview/mark-line-color-with-series_1.13.0.png
option: lineChart#markLine
---

# markLine support color with series

## Key option

## Demo source

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'test1',
      values: [
        {
          medalType: '1',
          count: 17,
          year: '1952',
          type: 'test1'
        },
        {
          medalType: '2',
          count: 15,
          year: '1956',
          type: 'test1'
        },
        {
          medalType: '1',
          count: 17,
          year: '1960',
          type: 'test1'
        },
        {
          medalType: '2',
          count: 15,
          year: '1965',
          type: 'test1'
        }
      ]
    },
    {
      id: 'test2',
      values: [
        {
          medalType: 'Silver Medals',
          count: 19,
          year: '1952'
        },
        {
          medalType: 'Silver Medals',
          count: 29,
          year: '2012'
        }
      ]
    },
    {
      id: 'test3',
      values: [
        {
          medalType: 'Silver Medals1',
          count: 9,
          year: '1952'
        },
        {
          medalType: 'Silver Medals2',
          count: 25,
          year: '2012'
        }
      ]
    }
  ],
  series: [
    {
      id: 'test1',
      dataId: 'test1',
      type: 'line',
      xField: 'year',
      yField: 'count',
      seriesField: 'type'
    },
    {
      id: '2',
      dataId: 'test2',
      type: 'line',
      xField: 'year',
      yField: 'count'
    },
    {
      id: '3',
      dataId: 'test3',
      type: 'line',
      xField: 'year',
      yField: 'count'
    }
  ],
  markLine: [
    {
      y: 'average',
      relativeSeriesIndex: 0,
      label: {
        visible: true,
        position: 'insideEndTop',
        formatMethod: datum => {
          return datum?.[0]?.y;
        },
        style: (datum, context) => {
          return {
            fill: context.relativeSeries.getMarkAttributeContext().seriesColor()
          };
        },
        labelBackground: {
          visible: false
        }
      },
      line: {
        style: (datum, context) => {
          return {
            stroke: context.relativeSeries.getMarkAttributeContext().seriesColor()
          };
        }
      },
      endSymbol: {
        style: (datum, context) => {
          return {
            fill: context.relativeSeries.getMarkAttributeContext().seriesColor()
          };
        }
      }
    },
    {
      y: 'average',
      relativeSeriesIndex: 1,
      label: {
        visible: true,
        position: 'insideEndTop',
        formatMethod: datum => {
          return datum?.[0]?.y;
        },
        style: (datum, context) => {
          return {
            fill: context.relativeSeries.getMarkAttributeContext().seriesColor()
          };
        },
        labelBackground: {
          visible: false
        }
      },
      line: {
        style: (datum, context) => {
          return {
            stroke: context.relativeSeries.getMarkAttributeContext().seriesColor()
          };
        }
      },
      endSymbol: {
        style: (datum, context) => {
          return {
            fill: context.relativeSeries.getMarkAttributeContext().seriesColor()
          };
        }
      }
    },
    {
      y: 'average',
      relativeSeriesIndex: 2,
      label: {
        visible: true,
        position: 'insideEndTop',
        formatMethod: datum => {
          return datum?.[0]?.y;
        },
        style: (datum, context) => {
          return {
            fill: context.relativeSeries.getMarkAttributeContext().seriesColor()
          };
        },
        labelBackground: {
          visible: false
        }
      },
      line: {
        style: (datum, context) => {
          return {
            stroke: context.relativeSeries.getMarkAttributeContext().seriesColor()
          };
        }
      },
      endSymbol: {
        style: (datum, context) => {
          return {
            fill: context.relativeSeries.getMarkAttributeContext().seriesColor()
          };
        }
      }
    }
  ],
  categoryField: '',
  legends: [
    {
      visible: true,
      position: 'middle',
      orient: 'bottom',
      data: (items, scale, context) => {
        return items.map((item, index) => {
          if (context._chart.getComponentsByType('markLine')[index]?._markerData?.latestData?.[0]?.y) {
            item.value = '均值:' + context._chart.getComponentsByType('markLine')[index]._markerData.latestData[0].y;
          }
          return item;
        });
      },
      item: {
        width: '15%',
        value: {
          alignRight: true,
          style: {
            fill: '#333',
            fillOpacity: 0.8,
            fontSize: 10
          },
          state: {
            unselected: {
              fill: '#d8d8d8'
            }
          }
        }
      }
    }
  ],
  crosshair: {
    xField: {
      visible: true,
      line: {
        type: 'line',
        style: {
          lineWidth: 1,
          opacity: 1,
          stroke: '#000',
          lineDash: [2, 2]
        }
      },
      bindingAxesIndex: [1]
    },
    yField: {
      visible: true,
      bindingAxesIndex: [0, 2],
      defaultSelect: {
        axisIndex: 2,
        datum: 40
      },
      line: {
        style: {
          lineWidth: 1,
          opacity: 1,
          stroke: '#000',
          lineDash: [2, 2]
        }
      }
    }
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[scrollBar](link)
