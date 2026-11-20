---
category: demo
group: data-zoom
title: 缩略轴支持大数据量场景下交互
keywords: areaChart,dataZoom
order: 29-6
cover: /vchart/preview/data-zoom-big-data_1.10.0.gif
option: barChart#dataZoom
---

# 缩略轴支持大数据量场景下交互

8w条数据量下丝滑交互。

## 关键配置

- `backgroundChart`属性声明为缩略轴样式, 大数据量场景下建议设置为不显示, 提高节点渲染性能。
- `tolerance`属性声明为背景图表节点压缩率, 如果需要显示背景图表可以配置采样压缩率(如果不配置则默认将节点限制在10000个)。

## 代码演示

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

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
