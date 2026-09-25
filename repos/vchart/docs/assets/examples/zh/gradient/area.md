---
category: demo
group: gradient
title: 渐变面积图
keywords: areaChart,comparison,trend,area,gradient
order: 38-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/gradient/area.png
option: areaChart
---

# 渐变面积图

可以在图元样式的 `fill` 和 `stroke` 等支持配置颜色的属性上配置渐变色，目前支持三种渐变配置：线性渐变、径向渐变、锥形渐变。该例子展示了线性渐变的使用。

## 关键配置

- 线性渐变配置如下

```javascript livedemo
// 线性渐变，前四个参数分别是 x0, y0, x1, y1, 范围从 0 - 1，相当于在图形包围盒中的百分比
{
  gradient: 'linear',
  x0: 0,
  y0: 0,
  x1: 0,
  y1: 1,
  stops: [
    {
      offset: 0,
      color: 'red' // 0% 处的颜色
    },
    {
      offset: 1,
      color: 'blue' // 100% 处的颜色
    }
  ],
}
```

## 代码演示

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    id: 'data',
    values: [
      {
        x: 'Monday',
        y: 4
      },
      {
        x: 'Tuesday',
        y: 5
      },
      {
        x: 'Wednesday',
        y: 4
      },
      {
        x: 'Thursday',
        y: 6
      },
      {
        x: 'Friday',
        y: 8
      },
      {
        x: 'Saturday',
        y: 10
      },
      {
        x: 'Sunday',
        y: 9
      }
    ]
  },
  xField: 'x',
  yField: 'y',
  area: {
    style: {
      curveType: 'monotone',
      fill: {
        gradient: 'linear',
        x0: 0,
        y0: 0.5,
        x1: 1,
        y1: 0.5,
        stops: [
          {
            offset: 0,
            color: '#009DB5',
            opacity: 0.3
          },
          {
            offset: 1,
            color: '#F0B71F',
            opacity: 0.3
          }
        ]
      }
    }
  },
  line: {
    style: {
      curveType: 'monotone',
      stroke: {
        gradient: 'linear',
        x0: 0,
        y0: 0.5,
        x1: 1,
        y1: 0.5,
        stops: [
          {
            offset: 0,
            color: '#009DB5'
          },
          {
            offset: 1,
            color: '#F0B71F'
          }
        ]
      }
    }
  },
  point: {
    style: {
      fill: '#fff',
      stroke: {
        field: 'x',
        scale: 'color'
      }
    }
  },
  color: {
    type: 'ordinal',
    domain: [
      {
        dataId: 'data',
        fields: ['x']
      }
    ],
    range: ['#009DB5', '#009DB5', '#009DB5', '#92be92', '#9fae52', '#F0B71F', '#F0B71F']
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
