---
title: 103. How to configure tooltip and legend shape as rectangles with rounded corners</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to configure Legend Shape as a rectangle with rounded corners?</br>


## Description

As shown below:</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/XRpvbfuWSozkLKxM8RxcN4lanXl.gif' alt='' width='1280' height='494'>

## Solution

Support configuration as'rectRound 'type</br>


1. Tooltip: `shapeType:"rectRound"`</br>
```
tooltip: {
    mark: {
      content: [
        {
          shapeType: 'rectRound',
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }</br>
```
1. Legend: </br>
```
legends: {
    visible: true,
    orient: 'right',
    
    item: {
      width: '15%',
      shape: {
        style: {
          symbolType: 'rectRound'
        }
      }
    }
  },</br>
```
## Code Example

```

const spec = {
  type: 'pie',
  data: [
    {
      id: 'pie',
      values: [
  { value: 10, category: 'One' },
  { value: 9, category: 'Two' },
  { value: 6, category: 'Three' },
  { value: 5, category: 'Four' },
  { value: 4, category: 'Five' },
  { value: 3, category: 'Six' },
  { value: 1, category: 'Seven' }
]
    }
  ],
  categoryField: 'category',
  valueField: 'value',
  legends: {
    visible: true,
    orient: 'right',
    
    item: {
      width: '15%',
      shape: {
        style: {
          symbolType: 'rectRound'
        }
      }
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          shapeType: 'rectRound',
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## Result

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/MPK9bjPmgoHCZ0xwtwVccRMinTd.gif' alt='' width='996' height='678'>

## Related Documents



*  Tutorials: https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend , https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip</br>
*  API：https://visactor.bytedance.net/vchart/option/barChart#tooltip.dimension.content，https://visactor.bytedance.net/vchart/option/barChart-legends-discrete#item.shape.style.symbolType</br>
*  Github：https://github.com/VisActor/VChart/</br>

