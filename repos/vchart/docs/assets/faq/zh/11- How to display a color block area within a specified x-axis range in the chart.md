---
title: 63. 如何在图表中显示一个色块区域，区域是覆盖在指定的 x 轴范围之内？</br>
---
## 问题标题

如何在图表中显示一个色块区域，区域是覆盖在指定的 x 轴范围之内？</br>


## 问题描述

类似下图的效果，希望在图表里指定的 x 轴范围绘制一个颜色色块，在 VChart 该如何配置？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/SOYtb3xBOodWeSx72dpcnWY1n9f.gif' alt='' width='1108' height='488'>

## 解决方案

你可以通过 `markArea` 组件实现这个效果，使用 `markArea.coordinates` 属性声明要标注的数据范围。</br>
*  `coordinates`：支持配置数据值，VChart 会自动根据数据映射到画布坐标进行范围绘制。</br>
```
  markArea: [
    {
      coordinates: [
        {
          Date: 'Jan-20',
          Price: 0.18
        },
        {
          Date: 'Mar-23',
          Price: 0.18
        },
        {
          Date: 'Mar-23',
          Price: 0.12
        },
        {
          Date: 'Jan-20',
          Price: 0.12
        }
      ],
      label: {
        text: 'Electricite prices have surged since 2020',
        position: 'insideTop'
      }
    }
  ],</br>
```


## 代码示例 

https://visactor.io/vchart/demo/marker/mark-area-basic</br>


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HO0MbfC8co3vstxnkMccptVUnhg.gif' alt='' width='1671' height='1044'>

## 相关文档

*  github：https://github.com/VisActor/VChart</br>
*  MarkArea 示例：https://visactor.io/vchart/demo/marker/mark-area-basic</br>
*  MarkArea 教程：https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/marker</br>

