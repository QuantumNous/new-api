---
title: 103.tooltip 和 legend shape如何配置为带圆角的矩形</br>
---
## 问题标题

legend shape如何配置为带圆角的矩形？</br>


## 问题描述

如下图：</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TopPbZHXFohFuPxKK0Jc2djancg.gif' alt='' width='1378' height='532'>





## 解决方案 

支持配置为 'rectRound' 类型</br>


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
## 代码示例  

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
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/XS2TbckmToJJMDxo9C1c4zD2njf.gif' alt='' width='996' height='678'>



## 相关文档

*  教程：https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend，https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip</br>
*  API：https://visactor.bytedance.net/vchart/option/barChart#tooltip.dimension.content，https://visactor.bytedance.net/vchart/option/barChart-legends-discrete#item.shape.style.symbolType</br>
*  Github：https://github.com/VisActor/VChart/</br>

