---
title: Does the tooltip support changing the background color?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

Does the tooltip support changing the background color?</br>
## Problem Description

When I use VChart, I want to set the background color of the tooltip, but I cannot find the relevant field in the configuration document. I would like to ask, does the tooltip in VChart support setting the background color? If supported, how should it be configured?</br>
## Solution

You can set the style of the Tooltip component background through tooltip.style.panel in the VChart spec, including margins, background color, borders, shadows, etc. At the same time, tooltip.style also supports customizing the title, text, and shape styles of Tooltip:</br>
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
## Code Example

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


## Results

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/E5sObuRRJoJNrMx8oPFc24dFnwc.gif' alt='' width='1690' height='1062'>



## Quote

*  Github: https://github.com/VisActor/VChart</br>
*  Demo: https://visactor.bytedance.net/vchart/demo/tooltip/custom-tooltip</br>
*  Spec: https://visactor.io/vchart/option/barChart#tooltip.style</br>