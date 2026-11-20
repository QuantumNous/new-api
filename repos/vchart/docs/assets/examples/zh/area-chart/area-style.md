---
category: examples
group: area chart
title: 面积图样式
keywords: areaChart,comparison,trend,area
order: 1-11
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/area-style.png
option: areaChart
---

# 面积图样式

通过 _area.style_ 属性可以配置 _面_ 图元相关的样式，通过 title.textStyle 可以配置标题样式。
本例展示了面积的渐变填充和标题的多行文本配置。

## 关键配置

- `type: area` 属性声明为面积图
- `xField` 属性声明为分类字段或时序字段
- `yField` 属性声明为数值字段
- `area.style` 属性声明为面积图元的样式星

## 代码演示

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      {
        time: '2:00',
        value: 15
      },
      {
        time: '4:00',
        value: 12
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 10
      },
      {
        time: '14:00',
        value: 12
      },
      {
        time: '16:00',
        value: 13
      },
      {
        time: '18:00',
        value: 14
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  axes: [
    {
      orient: 'left',
      visible: false,
      range: {
        min: 0,
        max: 20
      }
    },
    {
      orient: 'bottom',
      visible: false
    }
  ],
  point: {
    visible: false
  },
  area: {
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
            opacity: 1
          },
          {
            offset: 1,
            opacity: 0.3
          }
        ]
      }
    }
  },
  title: {
    padding: {
      left: 60,
      top: 20
    },
    textStyle: {
      character: [
        {
          text: 'Hive Table Count',
          fontSize: 30,
          fontWeight: 500,
          fill: '#BBB'
        },
        {
          text: '\n345, 239 Records',
          fontSize: 40,
          fill: '#000',
          fontWeight: 500
        }
      ]
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
