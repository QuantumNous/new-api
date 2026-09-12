---
category: demo
group: axis
title: 子刻度线和子网格线
keywords: lineChart,comparison,trend,line,axis
order: 25-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/subtick-and-subgrid.png
option: lineChart#axes
---

# 子刻度线和子网格线

坐标轴提供了 `subTick` 和 `subGrid` 属性，用于配置子刻度线和子网格线。

## 关键配置

在 `axes` 属性上为指定方向的坐标轴配置：

- `subTick` 属性，用于配置子刻度线，默认关闭，需要配置 `{ visible: true }` 开启
- `subGrid` 属性，用于配置子网格线

## 代码演示

```javascript livedemo
// just mock a dataset
function func(x) {
  x /= 10;
  return Math.cos(x * 2 + 1) * Math.sin(x * 2 + 1) * 50;
}

function generateData() {
  let data = [];
  const length = 100;
  for (let i = -1 * length; i <= length; i += 0.1) {
    data.push({
      x: i,
      y: func(i)
    });
  }

  return data;
}

const data = generateData();

const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      values: data
    }
  ],
  xField: 'x',
  yField: 'y',
  point: {
    visible: false
  },
  axes: [
    {
      orient: 'bottom',
      type: 'linear',
      min: -100,
      max: 100,
      label: {
        formatMethod: val => parseInt(val),
        style: {
          fill: '#000'
        }
      },
      tick: {
        visible: true,
        tickCount: 10,
        tickSize: 10,
        style: {
          stroke: '#000'
        }
      },
      subTick: {
        visible: true, // enable subTick
        tickSize: 6,
        style: {
          stroke: '#000'
        }
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      },
      subGrid: {
        visible: true, // enable subGrid
        style: {
          lineDash: [0]
        }
      },
      domainLine: {
        visible: true,
        style: {
          stroke: '#000'
        }
      }
    },
    {
      orient: 'left',
      type: 'linear',
      min: -50,
      max: 50,
      tick: {
        visible: true,
        tickSize: 10,
        style: {
          stroke: '#000'
        }
      },
      label: {
        style: {
          fill: '#000'
        }
      },
      subTick: {
        visible: true,
        tickSize: 6,
        style: {
          stroke: '#000'
        }
      },
      grid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      },
      subGrid: {
        visible: true,
        style: {
          lineDash: [0]
        }
      },
      domainLine: {
        visible: true,
        style: {
          stroke: '#000'
        }
      }
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
