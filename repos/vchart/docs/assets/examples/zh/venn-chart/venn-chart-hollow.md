---
category: examples
group: venn chart
title: 韦恩图
keywords: vennChart, proportion
cover: /vchart/preview/venn-chart-hollow_1.11.0.png
option: vennChart
---

# 空心韦恩图

韦恩图的 circle 和 overlap 图元可以自由设置样式。

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入registerVennChart并执行
// import { registerVennChart } from '@visactor/vchart';
// registerVennChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerVennChart();
/** --在业务中使用时请删除以上代码-- */

const spec = {
  type: 'venn',
  data: {
    values: [
      { sets: ['A'], value: 30 },
      { sets: ['B'], value: 10 },
      { sets: ['C'], value: 8 },
      { sets: ['D'], value: 6 },
      { sets: ['A', 'B'], value: 4 },
      { sets: ['A', 'C'], value: 3 },
      { sets: ['A', 'D'], value: 3 }
    ]
  },
  categoryField: 'sets',
  valueField: 'value',
  seriesField: 'sets',
  circle: {
    style: {
      strokeOpacity: 0.8,
      fill: 'transparent',
      lineWidth: 8
    },
    state: {
      hover: {
        stroke: 'black',
        lineWidth: 8
      },
      hover_reverse: {
        strokeOpacity: 0.2
      }
    }
  },
  overlap: {
    style: {
      strokeOpacity: 0.8,
      fill: 'transparent',
      lineWidth: 8
    },
    state: {
      hover: {
        stroke: 'black',
        lineWidth: 8
      },
      hover_reverse: {
        strokeOpacity: 0.2
      }
    }
  },
  label: {
    style: {
      fill: 'black'
    }
  },
  legends: [
    {
      visible: true,
      position: 'middle',
      orient: 'bottom',
      data: items => {
        items.forEach(({ shape }) => (shape.fill = shape.stroke));
        return items;
      }
    }
  ],
  tooltip: {
    mark: {
      updateContent: prev => {
        prev?.forEach(line => {
          line.shapeFill = line.shapeStroke;
        });
        return prev;
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

[韦恩图](link)
