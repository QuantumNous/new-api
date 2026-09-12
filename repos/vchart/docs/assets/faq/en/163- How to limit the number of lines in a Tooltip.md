---
title: How to limit the number of lines in Tooltip?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---


How to limit the number of lines in Tooltip?</br>


## Problem description

When there are too many data items in the Tooltip, it will be automatically categorized as others after more than 20 items. Can I customize this number?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OE4pbWJcHoqD9Yxt8m7chItyn4b.gif' alt='' width='846' height='778'>



## Solution

Tooltip supports setting the maximum number of lines through `maxLineCount`. It should be noted that vchart's tooltip supports multiple types, and now they need to be set separately.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JjjzbGMZYoYbALxu6iEcv4iXn6f.gif' alt='' width='3318' height='1212'>



## Code Examples

```
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
  title: {
    visible: true,
    text: '100% stacked line chart of cosmetic products sales'
  },
  percent: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod(val) {
          return `${(val * 100).toFixed(2)}%`;
        }
      }
    }
  ],
  tooltip: {
    mark: {
      maxLineCount: 2
    },
    dimension: {
      maxLineCount: 2
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## Result Display

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KluNbf4YjoebixxlL7Hc6ecSntb.gif' alt='' width='1686' height='1056'>

## Related documents

*  [Tooltip tip information tutorial](https%3A%2F%2Fvisactor.com%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2FTooltip)</br>
*  [Tooltip configuration document](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FbarChart%23tooltip.dimension.maxLineCount)</br>
*  [VChart github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>

