---
title: How to configure a bar chart to display more of the axis labels when the labels are too long?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Question title

How to configure a bar chart to display more of the axis labels when the labels are too long?</br>


## Problem description

The axis text labels in the chart are relatively long. I hope to increase the axis width to display more text. How should I configure it?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/SFRLbq1uBo7CdKxqpLIcEIFPnee.gif' alt='' width='900' height='500'>

## Solution

You can configure axes.width to set the width of the axis component.</br>
1. `Width: '50%' `: Configure the percentage string, which represents that the component width accounts for half of the chart during layout</br>
```
  axes: [
    {
      orient: 'left',
      width: `50%`
    }
  ],</br>
```
1. `Width: 100 `: Configure a fixed value, representing the pixel width of the component width during layout</br>
## Code example

```
const spec = {
  type: 'bar',
  width:450,
  height: 250,
  data: [
    {
      id: 'barData',
      values: [
    {
        "name": "Product-Name-:Apple",
        "value": 214480
    },
    {
        "name": "Product-Name-:Google",
        "value": 155506
    },
    {
        "name": "Product-Name-:Amazon",
        "value": 100764
    },
    {
        "name": "Product-Name-:Microsoft",
        "value": 92715
    },
    {
        "name": "Product-Name-:Coca-Cola",
        "value": 66341
    },
    {
        "name": "Product-Name-:Samsung",
        "value": 59890
    },
    {
        "name": "Product-Name-:Toyota",
        "value": 53404
    },
    {
        "name": "Product-Name-:Mercedes-Benz",
        "value": 48601
    },
    {
        "name": "Product-Name-:Facebook",
        "value": 45168
    },
    {
        "name": "Product-Name-:McDonald's",
        "value": 43417
    },
    {
        "name": "Product-Name-:Intel",
        "value": 43293
    },

]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'name',
  axes: [
    {
      orient: 'bottom',
      visible: false
    },
    {
      orient: 'left',
      width: `50%`
    }
  ],
  label: {
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## Results show

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DPM6bE4K3ohHEuxKBMtccHuin5e.gif' alt='' width='900' height='500'>

## Related Documents

*  github：https://github.com/VisActor/VChart</br>
*  https://visactor.io/vchart/option/barChart-axes-linear#width</br>

