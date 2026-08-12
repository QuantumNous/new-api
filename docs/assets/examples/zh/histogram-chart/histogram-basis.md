---
category: examples
group: histogram chart
title: 基础直方图
keywords: histogram,distribution,rectangle
order: 3-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/histogram-chart/histogram-basis.png
option: histogramChart
---

# 基础直方图

直方图，又称质量分布图，用于表示数据的分布情况，是一种常见的统计图表。 一般用横轴表示数据区间，纵轴表示分布情况，柱子越高，则落在该区间的数量越大。

## 关键配置

- `xField` 属性声明为频率统计左区间字段
- `x2Field` 属性声明为频率统计右区间字段
- `yField` 属性声明为频率数值字段

## 代码演示

```javascript livedemo
const spec = {
  data: [
    {
      name: 'data1',
      values: [
        {
          x0: -400,
          x1: -380,
          frequency: 0
        },
        {
          x0: -380,
          x1: -360,
          frequency: 4
        },
        {
          x0: -360,
          x1: -340,
          frequency: 7
        },
        {
          x0: -340,
          x1: -320,
          frequency: 7
        },
        {
          x0: -320,
          x1: -300,
          frequency: 18
        },
        {
          x0: -300,
          x1: -280,
          frequency: 30
        },
        {
          x0: -280,
          x1: -260,
          frequency: 33
        },
        {
          x0: -260,
          x1: -240,
          frequency: 80
        },
        {
          x0: -240,
          x1: -220,
          frequency: 98
        },
        {
          x0: -220,
          x1: -200,
          frequency: 124
        },
        {
          x0: -200,
          x1: -180,
          frequency: 161
        },
        {
          x0: -180,
          x1: -160,
          frequency: 176
        },
        {
          x0: -160,
          x1: -140,
          frequency: 227
        },
        {
          x0: -140,
          x1: -120,
          frequency: 276
        },
        {
          x0: -120,
          x1: -100,
          frequency: 321
        },
        {
          x0: -100,
          x1: -80,
          frequency: 452
        },
        {
          x0: -80,
          x1: -60,
          frequency: 441
        },
        {
          x0: -60,
          x1: -40,
          frequency: 505
        },
        {
          x0: -40,
          x1: -20,
          frequency: 521
        },
        {
          x0: -20,
          x1: 0,
          frequency: 733
        },
        {
          x0: 0,
          x1: 20,
          frequency: 892
        },
        {
          x0: 20,
          x1: 40,
          frequency: 362
        },
        {
          x0: 40,
          x1: 60,
          frequency: 267
        },
        {
          x0: 60,
          x1: 80,
          frequency: 223
        },
        {
          x0: 80,
          x1: 100,
          frequency: 157
        },
        {
          x0: 100,
          x1: 120,
          frequency: 170
        },
        {
          x0: 120,
          x1: 140,
          frequency: 124
        },
        {
          x0: 140,
          x1: 160,
          frequency: 112
        },
        {
          x0: 160,
          x1: 180,
          frequency: 73
        },
        {
          x0: 180,
          x1: 200,
          frequency: 80
        },
        {
          x0: 200,
          x1: 220,
          frequency: 49
        },
        {
          x0: 220,
          x1: 240,
          frequency: 33
        },
        {
          x0: 240,
          x1: 260,
          frequency: 30
        },
        {
          x0: 260,
          x1: 280,
          frequency: 21
        },
        {
          x0: 280,
          x1: 300,
          frequency: 9
        },
        {
          x0: 300,
          x1: 320,
          frequency: 13
        },
        {
          x0: 320,
          x1: 340,
          frequency: 11
        },
        {
          x0: 340,
          x1: 360,
          frequency: 5
        },
        {
          x0: 360,
          x1: 380,
          frequency: 4
        },
        {
          x0: 380,
          x1: 400,
          frequency: 4
        },
        {
          x0: 400,
          x1: 420,
          frequency: 2
        },
        {
          x0: 420,
          x1: 440,
          frequency: 8
        },
        {
          x0: 440,
          x1: 460,
          frequency: 2
        },
        {
          x0: 460,
          x1: 480,
          frequency: 3
        },
        {
          x0: 480,
          x1: 500,
          frequency: 10
        },
        {
          x0: 500,
          x1: 520,
          frequency: 7
        },
        {
          x0: 520,
          x1: 540,
          frequency: 14
        },
        {
          x0: 540,
          x1: 560,
          frequency: 6
        },
        {
          x0: 560,
          x1: 580,
          frequency: 1
        },
        {
          x0: 580,
          x1: 600,
          frequency: 3
        },
        {
          x0: 600,
          x1: 620,
          frequency: 0
        },
        {
          x0: 620,
          x1: 640,
          frequency: 6
        },
        {
          x0: 640,
          x1: 660,
          frequency: 5
        },
        {
          x0: 660,
          x1: 680,
          frequency: 3
        },
        {
          x0: 680,
          x1: 700,
          frequency: 2
        },
        {
          x0: 700,
          x1: 720,
          frequency: 0
        }
      ]
    }
  ],
  type: 'histogram',
  xField: 'x0',
  x2Field: 'x1',
  yField: 'frequency',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Arrival Time Histogram',
    textStyle: {
      height: 50,
      lineWidth: 3,
      fill: '#333',
      fontSize: 25,
      fontFamily: 'Times New Roman'
    },
    subtextStyle: {
      character: [
        {
          text: 'This histogram details the distribution of the number of seconds the arrival of tram line 1 of Amsterdam on 2 October 2017 deviated from the planning on each stop in each trip.\nThe data was filtered to remove 4 extreme measurements from ~7000 datapoints that caused significant skewing.',
          fontFamily: 'Times New Roman',
          fontSize: 14,
          fill: '#333'
        },
        {
          text: '\ndata source: https://observablehq.com/@nickrttn/departure-time-histogram',
          fontSize: 10,
          fill: '#333',
          fillOpacity: 0.5
        }
      ]
    }
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'frequency'
      },
      content: [
        {
          key: datum => datum['x0'] + '～' + datum['x1'],
          value: datum => datum['frequency']
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

[柱状图](link)
