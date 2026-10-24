---
category: demo
group: data-zoom
title: datazoom supports interaction in large data scenarios
keywords: areaChart,dataZoom
order: 29-6
cover: /vchart/preview/data-zoom-big-data_1.10.0.gif
option: barChart#dataZoom
---

# Datazoom Supports Interaction in Large Data Scenarios

Smooth interaction with 80,000 pieces of data.

## Key Configuration

- The `backgroundChart` attribute is declared as abbreviated axis style. In scenarios with large data volume, it is recommended to set it to not display to improve node rendering performance.
- The `tolerance` attribute is declared as the background chart node compression rate. If you need to display the background chart, you can configure the sampling compression rate (if not configured, the nodes will be limited to 10,000 by default).

## Live Demo

```javascript livedemo
const responseOrder = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/order-count-data.json');
const dataOrder = await responseOrder.json();

const responseProfit = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/profit-count-data.json');
const dataProfit = await responseProfit.json();


const spec = {
  color: [
    '#33ADFF',
    '#FFCF33',
    '#FFA763',
    '#9F97FF',
    '#FF97BC'
  ],
  type: 'common',
  series: [{
    id: 'area1',
    type: 'area',
    dataId: 'areaData1',
    xField: 'time',
    yField: 'value',
    point: {
      visible: false
    },
    area: {
      style: {
        fillOpacity: 0.2,
        lineWidth: 1
      }
    },
    name: '成交订单数'
  }, {
    id: 'area2',
    type: 'area',
    dataId: 'areaData2',
    xField: 'time',
    yField: 'value',
    point: {
      visible: false
    },
    area: {
      style: {
        fillOpacity: 0.2,
        lineWidth: 1
      }
    },
    name: '成交金额'
  }],
  axes: [{
    orient: 'left',
    seriesId: 'area1'
  },{
    orient: 'right',
    seriesId: 'area2'
  },{
    orient: 'bottom',
    type: 'band',
    seriesId: ['area1', 'area2']
  }],
  dataZoom: [
    {
      orient: 'bottom',
      start: 0.95,
      end: 1,
      maxSpan: 0.05,
      tolerance: 4,
      selectedBackgroundChart: {
        area: {
          visible: false,
          style: {
            visible: false
          }
        },
        line: {
          visible: false,
          style: {
            visible: false
          }
        }
      }
    }
  ],
  data: [
    {
      id: 'areaData1',
      values: dataOrder
    },
    {
      id: 'areaData2',
      values: dataProfit
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach links to tutorials or API documentation related to the demo configuration.
