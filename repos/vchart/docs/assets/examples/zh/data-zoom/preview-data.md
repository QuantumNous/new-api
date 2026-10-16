---
category: demo
group: data-zoom
title: 缩略轴预览图表样式配置
keywords: barChart,dataZoom
order: 29-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/data-zoom/preview-data.png
option: barChart#dataZoom
---

# 缩略轴预览图表样式配置

在缩略轴中可以配置预览图表以显示统计数据, 统计数据为关联数据在指标维度上的累加. 在 Vchart 中, 提供了对背景图表自由灵活的样式配置.

## 关键配置

- `backgroundChart`属性声明为预览图表的样式, `line`对应的是预览图表的折线图样式; `area`对应的是预览图表的面积图样式
- `selectedBackgroundChart`属性声明为选中部分的预览图表样式, `line`对应的是预览图表的折线图样式; `area`对应的是预览图表的面积图样式
- 除此之外, 样式配置还支持背景样式、选中背景样式、正在拖拽中的提示图元样式、左右手柄样式、中间手柄样式等, 具体详见 [spec 配置](../../option/barChart#dataZoom).

## 代码演示

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

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
