---
title: 1. How to implement multi-group bar chart and interact with highlighting by grouping dimension?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to implement multi-group bar chart and interact with highlighting by grouping dimension?</br>
## Description

Solution for implementing a multi-group bar chart similar to the following figure: </br>
1. Expect two groups to differentiate in style through color transparency.</br>
1. When the mouse hovers over a column block, all blocks of the same color are highlighted in linkage.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Es5DbciM9oSzIsxkpp9crpPTnyh.gif' alt='' width='1030' height='510'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/O72XboUIYoaAgaxeqGZcacxun2k.gif' alt='' width='153' height='353'>

## Solution

1. Requires 4 data fields:</br>
1. 3 grouping fields: There are 3 layers of grouping on the x-axis, corresponding to fields `xField: ['type', 'type1', 'type2'] `;</br>
1. 1 series field: used to distinguish color series, `seriesField: 'color'`</br>


<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Np1zbHvqnoSXfKxM1KUctNCunI8.gif' alt='' width='1562' height='778'>

1. Highlight interaction: You can configure the built-in `element-highlight-by-group `interaction in VChart, specify the interaction highlighting state to be named `'highligh' `, so as to add a stroke effect to the column in the graphic style:</br>
```
  interactions:[
    {
       type: 'element-highlight-by-group',
       highlightState:'highlight'
    }
  ],
  bar:{
    state:{
      highlight:{
        stroke:"black",
        lineWidth:1,
        zIndex:100
      }
    }
  },</br>
```


## Code Example  

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QsmQblpxzovAc4xhr8vcRbV0nPc.gif' alt='' width='812' height='410'>

```
const spec = {
  type: 'bar',
  height:400,
  data: [
    {
      values: [
        { type: 'Category One', min: 80,  color: 'A', type1: 'p', type2: 'T' },
        { type: 'Category One', min: 40,  color: 'B', type1: 'p', type2: 'T' },
        { type: 'Category One', min: 40,  color: 'D', type1: 'p', type2: 'T' },
        { type: 'Category One', min: 75,  color: 'C', type1: 'p', type2: 'T' },
        { type: 'Category One', min: 30,  color: 'E', type1: 'p', type2: 'T' },

        { type: 'Category One', min: 70,  color: 'A', type1: 'p', type2: 'T1' },
        { type: 'Category One', min: 40,  color: 'B', type1: 'p', type2: 'T1' },
        { type: 'Category One', min: 40,  color: 'D', type1: 'p', type2: 'T1' },
        { type: 'Category One', min: 50,  color: 'C', type1: 'p', type2: 'T1' },
        { type: 'Category One', min: 30,  color: 'E', type1: 'p', type2: 'T1' },

        { type: 'Category One', min: 70,  color: 'A', type1: 'p', type2: 'T2' },
        { type: 'Category One', min: 40,  color: 'B', type1: 'p', type2: 'T2' },
        { type: 'Category One', min: 40,  color: 'D', type1: 'p', type2: 'T2' },
        { type: 'Category One', min: 50,  color: 'C', type1: 'p', type2: 'T2' },
        { type: 'Category One', min: 30,  color: 'E', type1: 'p', type2: 'T2' },

        { type: 'Category One', min: 70,  color: 'A', type1: 'p', type2: 'T3' },
        { type: 'Category One', min: 40,  color: 'B', type1: 'p', type2: 'T3' },
        { type: 'Category One', min: 40,  color: 'D', type1: 'p', type2: 'T3' },
        { type: 'Category One', min: 50,  color: 'C', type1: 'p', type2: 'T3' },
        { type: 'Category One', min: 30,  color: 'E', type1: 'p', type2: 'T3' },

        { type: 'Category One', min: 70,  color: 'A', type1: 'p', type2: 'T4' },
        { type: 'Category One', min: 40,  color: 'B', type1: 'p', type2: 'T4' },
        { type: 'Category One', min: 40,  color: 'D', type1: 'p', type2: 'T4' },
        { type: 'Category One', min: 50,  color: 'C', type1: 'p', type2: 'T4' },
        { type: 'Category One', min: 30,  color: 'E', type1: 'p', type2: 'T4' },
        
        { type: 'Category One', min: 80,  color: 'A', type1: 'p1', type2: 'T' },
        { type: 'Category One', min: 40,  color: 'B', type1: 'p1', type2: 'T' },
        { type: 'Category One', min: 40,  color: 'D', type1: 'p1', type2: 'T' },
        { type: 'Category One', min: 75,  color: 'C', type1: 'p1', type2: 'T' },
        { type: 'Category One', min: 30,  color: 'E', type1: 'p1', type2: 'T' },

        { type: 'Category One', min: 70,  color: 'A', type1: 'p1', type2: 'T1' },
        { type: 'Category One', min: 40,  color: 'B', type1: 'p1', type2: 'T1' },
        { type: 'Category One', min: 40,  color: 'D', type1: 'p1', type2: 'T1' },
        { type: 'Category One', min: 50,  color: 'C', type1: 'p1', type2: 'T1' },
        { type: 'Category One', min: 30,  color: 'E', type1: 'p1', type2: 'T1' },

        { type: 'Category One', min: 70,  color: 'A', type1: 'p1', type2: 'T2' },
        { type: 'Category One', min: 40,  color: 'B', type1: 'p1', type2: 'T2' },
        { type: 'Category One', min: 40,  color: 'D', type1: 'p1', type2: 'T2' },
        { type: 'Category One', min: 50,  color: 'C', type1: 'p1', type2: 'T2' },
        { type: 'Category One', min: 30,  color: 'E', type1: 'p1', type2: 'T2' },

        { type: 'Category One', min: 70,  color: 'A', type1: 'p1', type2: 'T3' },
        { type: 'Category One', min: 40,  color: 'B', type1: 'p1', type2: 'T3' },
        { type: 'Category One', min: 40,  color: 'D', type1: 'p1', type2: 'T3' },
        { type: 'Category One', min: 50,  color: 'C', type1: 'p1', type2: 'T3' },
        { type: 'Category One', min: 30,  color: 'E', type1: 'p1', type2: 'T3' },

        { type: 'Category One', min: 70,  color: 'A', type1: 'p1', type2: 'T4' },
        { type: 'Category One', min: 40,  color: 'B', type1: 'p1', type2: 'T4' },
        { type: 'Category One', min: 40,  color: 'D', type1: 'p1', type2: 'T4' },
        { type: 'Category One', min: 50,  color: 'C', type1: 'p1', type2: 'T4' },
        { type: 'Category One', min: 30,  color: 'E', type1: 'p1', type2: 'T4' },

        

        { type: 'Category Two', min: 76,  color: 'A', type1: 'p', type2: 'T' },
        { type: 'Category Two', min: 40,  color: 'B', type1: 'p', type2: 'T' },
        { type: 'Category Two', min: 40,  color: 'D', type1: 'p', type2: 'T' },
        { type: 'Category Two', min: 65,  color: 'C', type1: 'p', type2: 'T' },
        { type: 'Category Two', min: 30,  color: 'E', type1: 'p', type2: 'T' },

        { type: 'Category Two', min: 70,  color: 'A', type1: 'p', type2: 'T1' },
        { type: 'Category Two', min: 40,  color: 'B', type1: 'p', type2: 'T1' },
        { type: 'Category Two', min: 40,  color: 'D', type1: 'p', type2: 'T1' },
        { type: 'Category Two', min: 50,  color: 'C', type1: 'p', type2: 'T1' },
        { type: 'Category Two', min: 30,  color: 'E', type1: 'p', type2: 'T1' },

        { type: 'Category Two', min: 70,  color: 'A', type1: 'p', type2: 'T2' },
        { type: 'Category Two', min: 40,  color: 'B', type1: 'p', type2: 'T2' },
        { type: 'Category Two', min: 40,  color: 'D', type1: 'p', type2: 'T2' },
        { type: 'Category Two', min: 50,  color: 'C', type1: 'p', type2: 'T2' },
        { type: 'Category Two', min: 30,  color: 'E', type1: 'p', type2: 'T2' },

        { type: 'Category Two', min: 70,  color: 'A', type1: 'p', type2: 'T3' },
        { type: 'Category Two', min: 40,  color: 'B', type1: 'p', type2: 'T3' },
        { type: 'Category Two', min: 40,  color: 'D', type1: 'p', type2: 'T3' },
        { type: 'Category Two', min: 50,  color: 'C', type1: 'p', type2: 'T3' },
        { type: 'Category Two', min: 30,  color: 'E', type1: 'p', type2: 'T3' },

        { type: 'Category Two', min: 70,  color: 'A', type1: 'p', type2: 'T4' },
        { type: 'Category Two', min: 40,  color: 'B', type1: 'p', type2: 'T4' },
        { type: 'Category Two', min: 40,  color: 'D', type1: 'p', type2: 'T4' },
        { type: 'Category Two', min: 50,  color: 'C', type1: 'p', type2: 'T4' },
        { type: 'Category Two', min: 30,  color: 'E', type1: 'p', type2: 'T4' },
        
        { type: 'Category Two', min: 80,  color: 'A', type1: 'p1', type2: 'T' },
        { type: 'Category Two', min: 40,  color: 'B', type1: 'p1', type2: 'T' },
        { type: 'Category Two', min: 40,  color: 'D', type1: 'p1', type2: 'T' },
        { type: 'Category Two', min: 75,  color: 'C', type1: 'p1', type2: 'T' },
        { type: 'Category Two', min: 30,  color: 'E', type1: 'p1', type2: 'T' },

        { type: 'Category Two', min: 70,  color: 'A', type1: 'p1', type2: 'T1' },
        { type: 'Category Two', min: 40,  color: 'B', type1: 'p1', type2: 'T1' },
        { type: 'Category Two', min: 40,  color: 'D', type1: 'p1', type2: 'T1' },
        { type: 'Category Two', min: 50,  color: 'C', type1: 'p1', type2: 'T1' },
        { type: 'Category Two', min: 30,  color: 'E', type1: 'p1', type2: 'T1' },

        { type: 'Category Two', min: 70,  color: 'A', type1: 'p1', type2: 'T2' },
        { type: 'Category Two', min: 40,  color: 'B', type1: 'p1', type2: 'T2' },
        { type: 'Category Two', min: 40,  color: 'D', type1: 'p1', type2: 'T2' },
        { type: 'Category Two', min: 50,  color: 'C', type1: 'p1', type2: 'T2' },
        { type: 'Category Two', min: 30,  color: 'E', type1: 'p1', type2: 'T2' },

        { type: 'Category Two', min: 70,  color: 'A', type1: 'p1', type2: 'T3' },
        { type: 'Category Two', min: 40,  color: 'B', type1: 'p1', type2: 'T3' },
        { type: 'Category Two', min: 40,  color: 'D', type1: 'p1', type2: 'T3' },
        { type: 'Category Two', min: 50,  color: 'C', type1: 'p1', type2: 'T3' },
        { type: 'Category Two', min: 30,  color: 'E', type1: 'p1', type2: 'T3' },

        { type: 'Category Two', min: 70,  color: 'A', type1: 'p1', type2: 'T4' },
        { type: 'Category Two', min: 40,  color: 'B', type1: 'p1', type2: 'T4' },
        { type: 'Category Two', min: 40,  color: 'D', type1: 'p1', type2: 'T4' },
        { type: 'Category Two', min: 50,  color: 'C', type1: 'p1', type2: 'T4' },
        { type: 'Category Two', min: 30,  color: 'E', type1: 'p1', type2: 'T4' },
      ]
    }
  ],
  interactions:[
    {
       type: 'element-highlight-by-group',
       highlightState:'highlight'
    }
  ],
  bar:{
    style:{
      fillOpacity:(data) => data.type1 === 'p' ? 1: 0.5
    },
    state:{
      highlight:{
        stroke:"black",
        lineWidth:1,
        zIndex:100
      }
    }
  },
  xField: ['type', 'type1', 'type2'],
  yField: 'min',
  seriesField: 'color',
  axes: [
    {
      orient:"left",
      label:{ visible: false},
      grid:{ style:{ lineDash:[4,4], stroke:'#dddddd'} }
    },
    {
      orient:"bottom",
      paddingInner:[0.1,0.05,0.5]
    }
  ],
  tooltip:{
      visible:false
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## Related Documentation

Grouped Stacked Column Chart demo: https://www.visactor.io/vchart/demo/bar-chart/stack-column</br>
Interactive demo: https://visactor.com/vchart/demo/axis/multiple-layers-of-axis?keyword=axis</br>
Related api: https://visactor.com/vchart/option/barChart#interactions.type.element-highlight-by-group</br>
github：https://github.com/VisActor/VChart</br>



