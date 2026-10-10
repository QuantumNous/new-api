---
title: 40. How to configure the style of the page flipper arrow in the VChart legend?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to configure the style of pager arrow in VChart legend?</br>


## Problem Description

I used a dark theme and hope to make the page flipper style more prominent. How should I configure it?</br>


## Solution

Legend pager corresponds to the configuration of `pager`.</br>
*  The pager text color can be configured through ` pager.textStyle.fill`.</br>
*  The page flipper button color can be configured through `pager.handler.style`.</br>
*  The style of the page turning button in the unavailable state needs to be configured through `pager.handler.state.disable.fill `.</br>
```
  legends: {
    visible: true,
    pager:{
      textStyle:{
        fill:"rgb(170,170,170)"
      },
      handler:{
        style:{
          fill:'rgb(170,170,170)'
        },
        state:{
          disable:{
            fill:'rgb(47,69,84)'
          }
        }
      }
    }
  },</br>
```
## Code Example

```

const spec = {
  type: 'pie',
  theme:"dark",
  width: 300,
  height: 300,
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  legends: {
    visible: true,
    pager:{
      textStyle:{
        fill:"rgb(170,170,170)"
      },
      handler:{
        style:{
          fill:'rgb(170,170,170)'
        },
        state:{
          disable:{
            fill:'rgb(47,69,84)'
          }
        }
      }
    }
  },
}

const vchart = new VChart((spec), { dom: CONTAINER_ID });
vchart.renderSync();

vchart.getCanvas().style.outline = '1px solid orange';
</br>
```


## Results

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WHEVbOEykoFqpexUDC5c1rdPnZc.gif' alt='' width='600' height='600'>





## Quote

*  Related configuration: https://visactor.io/vchart/option/barChart-legends-discrete#pager</br>
*  github：https://github.com/VisActor/VChart</br>

