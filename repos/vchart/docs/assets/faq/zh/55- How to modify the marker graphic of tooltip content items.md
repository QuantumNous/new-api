---
title: 100. 如何修改 tooltip 内容项的标记图形</br>
---
## 问题标题

如何修改 tooltip 内容项的标记图形？</br>


## 问题描述

我想针对折线图，将 tooltip 中的 shape 改成线性的，有什么好的实现方式吗？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/PQm0bkFL1oDWufxgwgqcJc6hnjb.gif' alt='' width='1644' height='548'>

## 解决方案 

修改 `shapeType` 为 `'rect'`即可。</br>


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
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VRDFbbwTZo3jshx8ygCc8f82nmd.gif' alt='' width='1688' height='1040'>



## 相关文档

*  教程：https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip</br>
*  API：https://visactor.io/vchart/option/barChart#tooltip.dimension.content(Object%7CObject%5B%5D).shapeType</br>
*  Github：https://github.com/VisActor/VChart/</br>

