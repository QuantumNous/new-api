---
category: demo
group: gradient
title: 渐变色-颜色划分移动端
keywords: lineChart,comparison,trend,line,gradient
order: 38-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/gradient/enhancement-gradient-line.png
option: lineChart
---

# 渐变色-颜色划分移动端

警戒线颜色上下分层。

## 关键配置

通过控制渐变色的 offset 值实现。

## 代码演示

```javascript livedemo
const spec = {
  data: {
    id: 'data1',
    values: [
      {
        x: '2:00',
        y: 82
      },
      {
        x: '4:00',
        y: 50
      },
      {
        x: '6:00',
        y: 64
      },
      {
        x: '8:00',
        y: 30
      },
      {
        x: '10:00',
        y: 40
      },
      {
        x: '12:00',
        y: 40
      },
      {
        x: '14:00',
        y: 56
      },
      {
        x: '16:00',
        y: 40
      },
      {
        x: '18:00',
        y: 64
      },
      {
        x: '20:00',
        y: 74
      },
      {
        x: '22:00',
        y: 98
      }
    ]
  },
  type: 'line',
  xField: 'x',
  yField: 'y',
  point: {
    style: {
      fill: data => {
        if (data.y > 60) {
          return 'green';
        }
        return 'red';
      }
    }
  },
  line: {
    style: {
      stroke: {
        gradient: 'linear',
        x0: 0.5,
        y0: 0,
        x1: 0.5,
        y1: 1,
        stops: [
          {
            offset: 0,
            color: 'green'
          },
          {
            offset: 0.5588235294117647,
            color: 'green'
          },
          {
            offset: 0.5588235294117647,
            color: 'red'
          },
          {
            offset: 1,
            color: 'red'
          }
        ]
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

附上和该 demo 配置相关联的教程或者 api 文档的链接。
