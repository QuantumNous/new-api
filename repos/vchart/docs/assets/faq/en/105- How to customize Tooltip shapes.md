---
title: 75. How to customize the shape of Tooltip in Vchart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Title

How to customize the shape of Tooltip in Vchart?</br>
# Description

Is there a way to customize the shape of the tooltip in Vchart?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/MZeubIsAFocHVqx79cCcf9gInce.gif' alt='' width='1290' height='970'>

# Solution

In the Vchart Spec, there are tooltip-related configurations. Configure the tooltip property to customize the tooltip shape. The mark attribute of the tooltip represents the effect when hovering over the graphic element. [https://visactor.io/vchart/option/pieChart#tooltip.mark](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FpieChart%23tooltip.mark). The mark.content represents the configuration of the content. Configure the shapeType field in mark.content to customize the shape of the tooltip.</br>
# Code Example

```
const spec = {
  type: 'pie',
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
  tooltip: { 
    mark: 
    { 
      content: { 
        key: datum => datum['type'],
        value: datum => datum['value'] + '%',
        shapeType: 'square' 
      } 
    },
  },
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
# Result

After running the code, the symbol of the tooltip becomes a rectangle.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/IZV0bOt1YoazkjxzinBc5zT3nPh.gif' alt='' width='1272' height='904'>

Online demo: [https://codesandbox.io/p/sandbox/tooltip-shape-cdzny7?file=%2Fsrc%2Findex.ts%3A44%2C2](https%3A%2F%2Fcodesandbox.io%2Fp%2Fsandbox%2Ftooltip-shape-cdzny7%3Ffile%3D%252Fsrc%252Findex.ts%253A44%252C2)</br>
# Related Documents

*  VChart official website: [https://visactor.io/vchart/](https%3A%2F%2Fvisactor.io%2Fvchart%2F)</br>
*  VChart tooltip configuration: [https://visactor.io/vchart/option/pieChart#tooltip.mark](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FpieChart%23tooltip.mark)</br>
*  VChart Github: [https://github.com/VisActor/VChart](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>