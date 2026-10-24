---
category: demo
group: crosshair
title: 雷达图的 crosshair
keywords: radarChart,comparison,crosshair,circle
order: 28-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/crosshair/polar-line.png
option: radarChart#crosshair
---

# 雷达图的 crosshair

crosshair 在不同的坐标系中的表现是不一样的，也对应不同的配置，在极坐标系中，需要配置在 `categoryField` 和 `valueField` 上。

## 关键配置

- `crosshair.categoryField` 配置维度数据的 crosshair，一般为角度轴，角度轴的 line 支持 'line' 和 'rect' 形状
- `crosshair.valueField` 配置指标数据的 crosshair，一般为半径轴，line 只支持 'line'

## 代码演示

```javascript livedemo
const spec = {
  type: 'radar',
  data: [
    {
      id: 'radar',
      values: [
        { name: 'Openlane', value1: 160.2, value2: 66.9 },
        { name: 'Yearin', value1: 150.1, value2: 50.5 },
        { name: 'Goodsilron', value1: 120.7, value2: 32.3 },
        { name: 'Condax', value1: 89.4, value2: 74.5 },
        { name: 'Opentech', value1: 78.5, value2: 29.7 },
        { name: 'Golddex', value1: 77.6, value2: 102.2 },
        { name: 'Isdom', value1: 69.8, value2: 22.6 },
        { name: 'Plusstrip', value1: 63.6, value2: 45.3 },
        { name: 'Kinnamplus', value1: 59.7, value2: 12.8 },
        { name: 'Zumgoity', value1: 54.3, value2: 19.6 },
        { name: 'Stanredtax', value1: 52.9, value2: 96.3 },
        { name: 'Conecom', value1: 42.9, value2: 11.9 },
        { name: 'Zencorporation', value1: 40.9, value2: 16.8 },
        { name: 'Iselectrics', value1: 39.2, value2: 9.9 },
        { name: 'Treequote', value1: 36.6, value2: 36.9 },
        { name: 'Sumace', value1: 34.8, value2: 14.6 },
        { name: 'Lexiqvolax', value1: 32.1, value2: 35.6 },
        { name: 'Sunnamplex', value1: 31.8, value2: 5.9 },
        { name: 'Faxquote', value1: 29.3, value2: 14.7 },
        { name: 'Donware', value1: 23.0, value2: 2.8 },
        { name: 'Warephase', value1: 21.5, value2: 12.1 },
        { name: 'Donquadtech', value1: 19.7, value2: 10.8 },
        { name: 'Nam-zim', value1: 15.5, value2: 4.1 },
        { name: 'Y-corporation', value1: 14.2, value2: 11.3 }
      ],
      transforms: [
        {
          type: 'fold',
          options: {
            key: 'type',
            value: 'value',
            fields: ['value1', 'value2']
          }
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value',
  seriesField: 'type',
  innerRadius: 0.3,
  outerRadius: 0.9,
  stack: true,
  area: {
    visible: true
  },
  point: {
    visible: false
  },
  axes: [
    {
      orient: 'angle',
      domainLine: {
        style: {
          lineDash: [2, 2]
        }
      },
      grid: {
        style: {
          lineDash: [2, 2]
        }
      },
      tick: {
        visible: false
      }
    },
    {
      orient: 'radius',
      grid: {
        smooth: true,
        style: {
          lineDash: [2, 2]
        }
      },
      label: {
        visible: true,
        inside: true
      }
    }
  ],
  crosshair: {
    categoryField: {
      visible: true,
      line: {
        style: {
          stroke: '#000',
          lineWidth: 1,
          opacity: 1,
          lineDash: [4, 4]
        }
      },
      label: {
        visible: true // Default is false
      }
    },
    valueField: {
      visible: true,
      line: {
        smooth: true,
        style: {
          stroke: '#000',
          lineWidth: 1,
          opacity: 1,
          lineDash: [4, 4]
        }
      },
      label: {
        visible: true // Default is false
      }
    }
  },
  legends: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
