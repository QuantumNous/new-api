---
title: 1. 如何实现多分组柱状图以及按照分组维度高亮的交互？</br>
---
## 问题标题

如何实现多分组柱状图以及按照分组维度高亮的交互？</br>


## 问题描述

类似下图的多分组柱状图如何实现：</br>
1. 期望两个分组通过颜色透明度进行样式上的区分；</br>
1. 当鼠标悬浮在一个柱子区块时，联动高亮相同颜色的所有区块；</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VDtbb37JAozAYixVQJmcytrqnwb.gif' alt='' width='1030' height='510'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DIoAbGpFQo4L7yxrytccIikCnvh.gif' alt='' width='153' height='353'>

## 解决方案 

1. 需要 4 个数据字段：</br>
1. 3 个分组字段：x 轴上有 3 层分组，分别对应字段 `xField: ['type', 'type1', 'type2']`；</br>
1. 1 个系列字段：用于区分颜色系列，` seriesField: 'color'`</br>


<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WT1SbzkDcowKRkxqg22cBCr2n0d.gif' alt='' width='1562' height='778'>

1. 高亮交互：可以配置 VChart 内置 `element-highlight-by-group`交互，指定交互高亮状态名为 `'highligh'`，从而在图元样式中，为柱子添加描边效果：</br>
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


## 代码示例  

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/IEGibzWSroj7P5xjA58cFUG1nkY.gif' alt='' width='812' height='410'>

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


## 相关文档

分组堆积柱形图demo：https://www.visactor.io/vchart/demo/bar-chart/stack-column</br>
交互demo：https://visactor.com/vchart/demo/axis/multiple-layers-of-axis?keyword=axis</br>
相关api：https://visactor.com/vchart/option/barChart#interactions.type.element-highlight-by-group</br>
github：https://github.com/VisActor/VChart</br>



