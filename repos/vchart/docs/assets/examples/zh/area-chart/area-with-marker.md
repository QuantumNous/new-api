---
category: examples
group: area chart
title: 多系列面积图
keywords: areaChart,comparison,trend,area
order: 1-10
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/area-with-marker.png
option: areaChart
---

# 多系列面积图

面积图以图形方式显示定量数据。 它基于折线图。 通常用颜色，纹理和阴影线强调轴和线之间的区域。 通常，一个面积图会比较两个或多个数量。面积图适用于想要体现在连续自变量下，一组或多组数据的趋势变化以及相互之间的对比，同时也能够观察到数据总量的变化趋势。

## 关键配置

- `type: area` 属性声明为面积图
- `xField` 属性声明为分类字段或时序字段
- `yField` 属性声明为数值字段
- `stack`属性声明为是否堆叠
- `markLine` 属性声明为参考线，用于数据标记, `markLine.coordinates` 用于指定数据坐标

## 代码演示

```javascript livedemo
const markLineStyle = {
  endSymbol: {
    style: {
      angle: 180,
      fill: '#000',
      dy: -5
    }
  },
  label: {
    dx: -22,
    dy: -20,
    labelBackground: {
      padding: [5, 10, 5, 10],
      style: {
        fill: '#000',
        borderRadius: 5
      }
    },
    style: {
      fill: '#fff'
    }
  }
};
const spec = {
  type: 'area',
  data: {
    values: [
      {
        time: '0:00',
        value: 0,
        type: 'A'
      },
      {
        time: '1:00',
        value: 1000,
        type: 'A'
      },
      {
        time: '2:00',
        value: 4500,
        type: 'A'
      },
      {
        time: '3:00',
        value: 6000,
        type: 'A'
      },
      {
        time: '4:00',
        value: 4500,
        type: 'A'
      },
      {
        time: '5:00',
        value: 1000,
        type: 'A'
      },
      {
        time: '6:00',
        value: 0,
        type: 'A'
      },
      {
        time: '4:00',
        value: 0,
        type: 'B'
      },
      {
        time: '5:00',
        value: 1000,
        type: 'B'
      },
      {
        time: '6:00',
        value: 7000,
        type: 'B'
      },
      {
        time: '7:00',
        value: 8500,
        type: 'B'
      },
      {
        time: '8:00',
        value: 7000,
        type: 'B'
      },
      {
        time: '9:00',
        value: 1000,
        type: 'B'
      },
      {
        time: '10:00',
        value: 0,
        type: 'B'
      },
      {
        time: '8:00',
        value: 0,
        type: 'C'
      },
      {
        time: '9:00',
        value: 1000,
        type: 'C'
      },
      {
        time: '10:00',
        value: 6500,
        type: 'C'
      },
      {
        time: '11:00',
        value: 8000,
        type: 'C'
      },
      {
        time: '12:00',
        value: 6500,
        type: 'C'
      },
      {
        time: '13:00',
        value: 1000,
        type: 'C'
      },
      {
        time: '14:00',
        value: 0,
        type: 'C'
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  seriesField: 'type',
  stack: false,
  markLine: [
    {
      coordinates: [
        {
          time: '3:00',
          value: 0
        },
        {
          time: '3:00',
          value: 6000
        }
      ],
      ...markLineStyle,
      label: {
        text: '6000',
        ...markLineStyle.label
      }
    },
    {
      coordinates: [
        {
          time: '7:00',
          value: 0
        },
        {
          time: '7:00',
          value: 8500
        }
      ],
      ...markLineStyle,
      label: {
        text: '8500',
        ...markLineStyle.label
      }
    },
    {
      coordinates: [
        {
          time: '11:00',
          value: 0
        },
        {
          time: '11:00',
          value: 8000
        }
      ],
      ...markLineStyle,
      label: {
        text: '8000',
        ...markLineStyle.label
      }
    }
  ],
  point: {
    visible: false
  },
  line: {
    style: {
      curveType: 'monotone'
    }
  },
  area: {
    style: {
      fillOpacity: 0.1
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[面积图](link)
