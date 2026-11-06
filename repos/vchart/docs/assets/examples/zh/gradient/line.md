---
category: demo
group: gradient
title: 渐变折线图
keywords: lineChart,comparison,trend,line,gradient
order: 38-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/gradient/line.png
option: lineChart
---

# 渐变折线图

## 关键配置

图元上的图形属性支持自定义映射。

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      fields: {
        y: {
          alias: 'minimum temperature'
        }
      },
      values: [
        {
          x: 'Monday',
          y: 18,
          c: 0
        },
        {
          x: 'Tuesday',
          y: 16,
          c: 0
        },
        {
          x: 'Wednesday',
          y: 17,
          c: 0
        },
        {
          x: 'Thursday',
          y: 18,
          c: 0
        },
        {
          x: 'Friday',
          y: 19,
          c: 0
        },
        {
          x: 'Saturday',
          y: 20,
          c: 0
        },
        {
          x: 'Sunday',
          y: 17,
          latest: true,
          c: 0
        },
        {
          x: 'Monday',
          y: 28,
          c: 1
        },
        {
          x: 'Tuesday',
          y: 26,
          c: 1
        },
        {
          x: 'Wednesday',
          y: 27,
          c: 1
        },
        {
          x: 'Thursday',
          y: 28,
          c: 1
        },
        {
          x: 'Friday',
          y: 29,
          c: 1
        },
        {
          x: 'Saturday',
          y: 30,
          c: 1
        },
        {
          x: 'Sunday',
          y: 27,
          latest: true,
          c: 1
        }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'c',
  line: {
    style: {
      curveType: 'basis',
      lineWidth: 2,
      stroke: {
        gradient: 'linear',
        x0: 0,
        y0: 0.5,
        x1: 1,
        y1: 0.5,
        stops: [
          {
            offset: 0,
            color: data => {
              if (data.c === 0) {
                return '#009800';
              }
              return '#000098';
            },
            opacity: 0
          },
          {
            offset: 0.5,
            color: data => {
              if (data.c === 0) {
                return '#1d983a';
              }
              return '#1d3a98';
            },
            opacity: 0.5
          },
          {
            offset: 1,
            color: data => {
              if (data.c === 0) {
                return '#4d98ca';
              }
              return '#4dca98';
            },
            opacity: 1
          }
        ]
      }
    }
  },
  point: {
    visible: false
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
