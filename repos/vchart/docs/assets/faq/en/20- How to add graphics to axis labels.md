---
title: How to make the axis label with graphics in VChart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Question title

How to make axis labels with graphics in VChart?</br>


## Problem description

Want to mark the special value label of the x-axis with a graph</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WedKbY1PIoM8C0x3kxIcj1eGnMf.gif' alt='' width='715' height='206'>

## Solution

The label of the coordinate axis currently supports the configuration of rich text content.</br>
```
 label: {
        formatMethod: label => {
          return {
            type: 'rich',
            text: [
              {
                text: `${label}`,
                fontSize: 16,
                fontWeight: 'bold',
                fontStyle: 'italic'
              },
              { image: `icon address`, width: 40, height: 40 },
            ]
          };
        }
      }</br>
```
## Code example

```
const rankIcon = {
  'Top 1': 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/gold-medal.svg',
  'Top 2': 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/silver-medal.svg',
  'Top 3': 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/bronze-medal.svg'
};
const spec = {
  type: 'bar',
  height: 300,
  data: [
    {
      id: 'barData',
      values: [
        { name: 'Top 1', value: 990 },
        { name: 'Top 2', value: 680 },
        { name: 'Top 3', value: 255 }
      ]
    }
  ],
  barWidth: 20,
  yField: 'name',
  xField: 'value',
  bar: {
    style: {
      cornerRadius: [0, 10, 10, 0],
      fill: {
        gradient: 'linear',
        x0: 0,
        y0: 0.5,
        x1: 1,
        y1: 0.5,
        stops: [
          { offset: 0, color: 'rgb(255,163,1)' },
          { offset: 1, color: 'rgb(255,4,0)' }
        ]
      }
    }
  },
  barBackground: {
    visible: true
  },
  label: {
    visible: true,
    position: 'center',
    style: {
      fill: 'white',
      stroke: false
    }
  },
  direction: 'horizontal',
  seriesField: 'type',
  padding: { left: 50 },
  axes: [
    {
      orient: 'left',
      minWidth: 50,
      label: {
        formatMethod: label => {
          return {
            type: 'rich',
            text: [
              { image: rankIcon[label], width: 40, height: 40 },
              {
                text: `${label}`,
                fontSize: 16,
                fontWeight: 'bold',
                fontStyle: 'italic'
              }
            ]
          };
        }
      }
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## Results show

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/NoDfbCtxyo1VEuxKhcmcZhxKnF3.gif' alt='' width='840' height='308'>

## Related Documents

*  github：https://www.visactor.io/vchart/option/barChart-axes-band#label.formatMethod</br>
*  Related demo: https://www.visactor.io/vchart/demo/axis/axis-richtext-label?keyword=axis</br>



