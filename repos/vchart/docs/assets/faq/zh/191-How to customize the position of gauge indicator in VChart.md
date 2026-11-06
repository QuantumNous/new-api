# VChart 仪表盘如何自定义标题的显示位置？

## 问题描述

希望标题在仪表盘指针的下方，同时显示两行文字，请问这个怎么配置？  
![demo](/vchart/faq/20-0.png)

## 解决方案

你可以配置指标卡 `indicator`。指标卡默认显示在图表中间，你可以配置一个 y 方向的偏移量。indicator 也支持多行文本，以及分别设置样式：

```js
indicator: [
  {
    visible: true,
    title: {
      style: {
        text: 'Normal',
        dy: 100,
        fill:'rgb(99,110,124)',
        fontSize: 40,
        fontWeight: 800
      }
    },
    content: [
      {
        visible: true,
        style: {
          fontSize: 20,
          dy: 100,
          fill:'rgb(193,200,204)',
          fontWeight: 800,
          text: 'Quality'
        }
      }
    ]
  }
],
```

## 代码示例

```javascript livedemo
const pointerPath =
  'M-0.020059 -0.978425 C-0.018029 -0.9888053 -0.013378 -1 0 -1 C0.01342 -1 0.01812 -0.989146 0.0201 -0.978425 C0.02161 -0.9702819 0.0692 -0.459505 0.09486 -0.184807 C0.10298 -0.097849 0.1089 -0.034548 0.11047 -0.018339 C0.11698 0.04908 0.07373 0.11111 0.00002 0.11111 C-0.07369 0.11111 -0.117184 0.04991 -0.110423 -0.018339 C-0.103662 -0.086591 -0.022089 -0.9680447 -0.020059 -0.978425Z';
const circlePath =
  'M1 0 C1 0.55228 0.55228 1 0 1 C-0.552285 1 -1 0.55228 -1 0 C-1 -0.552285 -0.552285 -1 0 -1 C0.55228 -1 1 -0.552285 1 0Z';

const spec = {
  type: 'gauge',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: '目标A',
          value: 0.6
        }
      ]
    }
  ],
  radiusField: 'type',
  angleField: 'value',
  seriesField: 'type',
  outerRadius: 0.8,
  innerRadius: 0.7,
  startAngle: -225,
  endAngle: 45,
  indicator: [
    {
      visible: true,
      offsetY: '50%',
      title: {
        style: {
          text: 'Normal',
          fill: 'rgb(99,110,124)',
          fontSize: 40,
          fontWeight: 800
        }
      },
      content: [
        {
          visible: true,
          style: {
            fontSize: 20,
            fill: 'rgb(193,200,204)',
            fontWeight: 800,
            text: 'Quality'
          }
        }
      ]
    }
  ],
  gauge: {
    type: 'circularProgress',
    cornerRadius: 10,
    progress: {
      style: {
        fill: {
          gradient: 'conical',
          stops: [
            {
              offset: 0,
              color: '#4FC6B4'
            },
            {
              offset: 1,
              color: '#31679E'
            }
          ]
        }
      }
    },
    track: {
      style: {
        fill: '#ccc'
      }
    }
  },
  pointer: {
    width: 0.5,
    height: 0.5,
    style: {
      path: pointerPath,
      fill: '#5A595E'
    }
  },
  pin: {
    style: {
      path: circlePath,
      fill: '#888'
    }
  },
  pinBackground: {
    width: 0.08,
    height: 0.08,
    style: {
      path: circlePath,
      fill: '#ddd'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [相关教程](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Indicator)
- [相关 API](https://visactor.io/vchart/option/gaugeChart#indicator.offsetY)
- [github](https://github.com/VisActor/VChart)
