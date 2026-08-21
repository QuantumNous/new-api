---
category: demo
group: data-zoom
title: Thumbnail Axis Preview Chart Style Configuration
keywords: barChart,dataZoom
order: 29-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/data-zoom/preview-data.png
option: barChart#dataZoom
---

# Thumbnail Axis Preview Chart Style Configuration

In the thumbnail axis, you can configure the preview chart to display statistical data, which is the accumulation of associated data on the metric dimension. In Vchart, flexible style configuration is provided for background charts.

## Key option

- The `backgroundChart` attribute is declared as the style of the preview chart, where `line` corresponds to the line chart style of the preview chart; `area` corresponds to the area chart style of the preview chart
- The `selectedBackgroundChart` attribute is declared as the style of the selected part of the preview chart, where `line` corresponds to the line chart style of the preview chart; `area` corresponds to the area chart style of the preview chart
- In addition, style configuration also supports background style, selected background style, dragging hint graphic style, left and right handle style, middle handle style, etc., for more details refer to [spec configuration](../../option/barChart#dataZoom).

## Demo source

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/stocks.json');
const data = await response.json();
const spec = {
  color: ['#1ac7c2', '#6f40aa', '#ccf59a', '#D4ADFC'],
  type: 'bar',
  dataId: 'bar',
  xField: 'Date',
  yField: 'Close',
  seriesField: 'Symbol',
  dataZoom: [
    {
      orient: 'bottom',
      backgroundChart: {
        area: {
          style: {
            lineWidth: 1,
            fill: '#D1DBEE'
          }
        },
        line: {
          style: {
            stroke: '#D1DBEE',
            lineWidth: 1
          }
        }
      },
      selectedBackgroundChart: {
        area: {
          style: {
            lineWidth: 1,
            fill: '#fbb934'
          }
        },
        line: {
          style: {
            stroke: '#fbb934',
            lineWidth: 1
          }
        }
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'top'
  },
  title: {
    text: 'This line chart shows the weekly price of several technology stocks in from 2016 to 2018 relative to each stock’s price on the highlighted date.',
    textStyle: {
      height: 50,
      lineWidth: 3,
      fill: '#333',
      fontSize: 25,
      fontFamily: 'Times New Roman'
    }
  },
  data: [
    {
      id: 'bar',
      values: data
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

## Related Tutorials

Attached are links to tutorials or API documentation related to this demo configuration.
