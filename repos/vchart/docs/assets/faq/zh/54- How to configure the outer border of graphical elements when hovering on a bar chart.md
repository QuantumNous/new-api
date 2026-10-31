---
title: 44. 柱状图如何配置hover时的图元外边框？</br>
---
## 问题标题

柱状图如何配置hover时的图元外边框？</br>
# 问题描述 


柱状图如何配置hover时展示的外边框效果？我希望hover时，会出现与图元有一定间隙的外部边框。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TL3Qb5YFeoV8mAxb2txcChgDnxd.gif' alt='' width='2246' height='996'>

## 解决方案 

在`bar.state.hover.outerBorder`中即可配置`lineWidth`边框粗细、`stroke`描边颜色和边框与`distance`图元的间隙。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/O9TtbjnXmoDUP4xoj6McCe8wnrh.gif' alt='' width='2302' height='1190'>





## 代码示例  

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
  xField: 'month',
  yField: 'sales',
  bar:{
    state:{
      hover:{
        zIndex:400,
        outerBorder:{
          lineWidth:1, // borderSize
          stroke:'#4e83fd', // borderColor
          distance: 3 // borderSpacing
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

在线效果参考：https://codesandbox.io/p/sandbox/hover-border-wq6lsr?file=%2Fsrc%2Findex.ts%3A23%2C23</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BSQabGRGpofkotx2K1ocqiU3nwh.gif' alt='' width='1476' height='998'>

## 相关文档

柱状图demo：https://www.visactor.io/vchart/demo/bar-chart/basic-column</br>
组合图教程：https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Bar</br>
github：https://github.com/VisActor/VChart</br>



