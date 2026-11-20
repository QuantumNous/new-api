---
title: 64. tooltip是否支持修改背景色</br>
---
## 问题标题

tooltip是否支持修改背景色?</br>


## 问题描述

我在使用 VChart 时，想要设置tooltip的背景色，但是在配置文档中没有找到相关字段。我想请问一下，VChart 中的tooltip是否支持设置背景色？如果支持，应该如何配置？</br>


## 解决方案

可以在 VChart spec 中通过 tooltip.style.panel 设置 Tooltip 组件背景的样式，包括边距、背景颜色、边框以及阴影等。同时 tooltip.style 也支持自定义 Tooltip 的标题、文字以及形状的样式：</br>
```
  tooltip: {
    style: {
      panel: {
        padding: {
          top: 10,
          bottom: 15,
          left: 10,
          right: 10
        },
        backgroundColor: '#eee',
        border: {
          color: '#ccc',
          width: 1,
          radius: 10
        },
        shadow: {
          x: 0,
          y: 0,
          blur: 10,
          spread: 5,
          color: '#ddd'
        }
      },
      titleLabel: {
        fontSize: 20,
        fontFamily: 'Times New Roman',
        fill: 'brown',
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: 24
      },
      keyLabel: {
        fontSize: 14,
        fontFamily: 'Times New Roman',
        fill: 'black',
        textAlign: 'center',
        lineHeight: 15,
        spacing: 10
      },
      valueLabel: {
        fontSize: 14,
        fill: 'black',
        textAlign: 'center',
        lineHeight: 15,
        spacing: 10
      },
      shape: {
        size: 15,
        spacing: 10
      },
      spaceRow: 10
    }
  }</br>
```


## 代码示例 

```
const markLineValue = 10000;
const spec = {
  type: 'line',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  stack: false,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  lineLabel: { visible: true },
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  point: {
    style: {
      opacity: 0
    },
    state: {
      dimension_hover: {
        opacity: 1,
        size: 10,
        lineWidth: 2,
        stroke: {
          scale: 'color',
          field: 'country'
        },
        fill: 'white'
      }
    }
  },
  markLine: [
    {
      y: markLineValue,
      endSymbol: {
        visible: false
      },
      line: {
        style: {
          stroke: 'orange',
          lineWidth: 2
        }
      }
    }
  ],
  tooltip: {
    style: {
      panel: {
        padding: {
          top: 10,
          bottom: 15,
          left: 10,
          right: 10
        },
        backgroundColor: '#eee',
        border: {
          color: '#ccc',
          width: 1,
          radius: 10
        },
        shadow: {
          x: 0,
          y: 0,
          blur: 10,
          spread: 5,
          color: '#ddd'
        }
      },
      titleLabel: {
        fontSize: 20,
        fontFamily: 'Times New Roman',
        fill: 'brown',
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: 24
      },
      keyLabel: {
        fontSize: 14,
        fontFamily: 'Times New Roman',
        fill: 'black',
        textAlign: 'center',
        lineHeight: 15,
        spacing: 10
      },
      valueLabel: {
        fontSize: 14,
        fill: 'black',
        textAlign: 'center',
        lineHeight: 15,
        spacing: 10
      },
      shape: {
        size: 15,
        spacing: 10
      },
      spaceRow: 10
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/US2sbSCnIo9GHVxIql7cPH0xnxb.gif' alt='' width='1690' height='1062'>



## 相关文档

*  Github: https://github.com/VisActor/VChart</br>
*  Demo: https://visactor.bytedance.net/vchart/demo/tooltip/custom-tooltip</br>
*  Spec: https://visactor.io/vchart/option/barChart#tooltip.style</br>



