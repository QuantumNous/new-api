---
category: demo
group: gradient
title: 渐变色-高度渐变
keywords: barChart,comparison,rectangle,gradient,distribution,rank
order: 38-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/gradient/bar.png
option: barChart
---

# 渐变色-高度渐变

柱图渐变色与高度相关。

## 关键配置

图元上的图形属性支持自定义映射。

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
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
        y: 10
      },
      {
        x: '10:00',
        y: 30
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
  xField: 'x',
  yField: 'y',
  bar: {
    style: {
      fill: {
        gradient: 'linear',
        x0: 0.5,
        y0: 0,
        x1: 0.5,
        y1: 1,
        stops: [
          {
            offset: 0,
            color: data => {
              if (data.y > 60) {
                return 'blue';
              }
              return 'red';
            }
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
