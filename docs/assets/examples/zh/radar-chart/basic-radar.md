---
category: examples
group: radar chart
title: 基础雷达图
keywords: radarChart,comparison,line,circle
order: 10-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/c0de7ff0a101bd4cb25c8170c.png
option: radarChart
---

# 基础雷达图

雷达图，可以用来展示多个维度的数据，以及维度间的对比。

## 关键配置

- `type: 'radar'`：声明雷达图类型
- `categoryField`：声明维度字段
- `valueField`：声明数值字段
- `axes`：配置雷达图的两个轴
  - 半径轴声明：`orient: 'radius'`
  - 角度轴声明：`orient: 'angle'`
- `point`：配置雷达图的点
  - `visible: false`：不展示点
- `area`：配置雷达图的面积
  - `visible: true`：展示面积
  - `state`：配置面积 hover 状态下的样式

## 代码演示

```javascript livedemo
const spec = {
  type: 'radar',
  data: [
    {
      id: 'radarData',
      values: [
        {
          key: 'Strength',
          value: 5
        },
        {
          key: 'Speed',
          value: 5
        },
        {
          key: 'Shooting',
          value: 3
        },
        {
          key: 'Endurance',
          value: 5
        },
        {
          key: 'Precision',
          value: 5
        },
        {
          key: 'Growth',
          value: 5
        }
      ]
    }
  ],
  categoryField: 'key',
  valueField: 'value',
  point: {
    visible: false // disable point
  },
  area: {
    visible: true, // display area
    state: {
      // The style in the hover state of the area
      hover: {
        fillOpacity: 0.5
      }
    }
  },
  line: {
    style: {
      lineWidth: 4
    }
  },
  axes: [
    {
      orient: 'radius', // radius axis
      zIndex: 100,
      min: 0,
      max: 8,
      domainLine: {
        visible: false
      },
      label: {
        visible: true,
        space: 0,
        style: {
          textAlign: 'center',
          stroke: '#fff',
          lineWidth: 4
        }
      },
      grid: {
        smooth: false,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'angle', // angle axis
      zIndex: 50,
      tick: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      label: {
        space: 20
      },
      grid: {
        style: {
          lineDash: [0]
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

[区间柱状图](link)
