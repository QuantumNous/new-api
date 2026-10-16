---
title: 100. How to modify the tag graphic of the tooltip content item</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to modify the tag graphic of the tooltip content item?</br>


## Description

I want to change the shape in the tooltip to linear for line charts. Is there a good implementation?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KlNqbZiqUotoHdxUtOscjrKHn6c.gif' alt='' width='1280' height='426'>

## Solution

Modify `shapeType `to `'rect ' `.</br>
## Code Example

```
const spec = {
    type: 'bar',
    data: [
      {
        id: 'barData',
        values: [
          { month: 'Monday', sales: 22 },
          { month: 'Tuesday', sales: 13 },
          { month: 'Wednesday', sales: 25 },
          { month: 'Thursday', sales: 29 },
          { month: 'Friday', sales: 38 }
        ]
      }
    ],
    tooltip: {
      mark: { 
        content: 
        [{ key: datum => datum['month'], value: datum => datum['sales'], shapeType: 'rect' }] 
      }
    },
    xField: 'month',
    yField: 'sales'
  };
  const vchart = new VChart(spec, { dom: CONTAINER_ID });
  vchart.renderSync();</br>
```


## Results show

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/UfYYbslPpotcnxxa5Nxc9lQmn3d.gif' alt='' width='1688' height='1040'>



## Related Documents

*  Tutorial: https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip</br>
*  API：https://visactor.io/vchart/option/barChart#tooltip.dimension.content(Object%7CObject%5B%5D).shapeType</br>
*  Github：https://github.com/VisActor/VChart/</br>



