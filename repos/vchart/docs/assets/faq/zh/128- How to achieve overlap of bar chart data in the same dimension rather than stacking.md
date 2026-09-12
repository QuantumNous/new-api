---
title: 0. 如何实现柱形图同维度数据前后重叠而不是堆叠效果？</br>
---
## 问题标题

如何实现柱形图同维度数据前后重叠而不是堆叠效果？</br>


## 问题描述

类似 （https://www.visactor.io/vchart/demo/bar-chart/stack-column）这样的堆积柱状图，</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/UgdfbSyQBoQlzdxMBePcRnScnAd.gif' alt='' width='812' height='510'>

想要实现不同颜色的柱子都从y轴0刻度开始画，前后重叠，而不是上下堆积，该如何实现？</br>


## 解决方案 

不同图表库的解决方案不一样，根据你给的demo，只需要将控制堆叠的字段设置为false 即可。</br>


<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/D2ifbCtD5ozyJBxK36ucSzAFnBh.gif' alt='' width='331' height='457'>



## 代码示例  

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'WY',
          Age: 'Under 5 Years',
          Population: 25635
        },
        {
          State: 'WY',
          Age: '5 to 13 Years',
          Population: 1890
        },
        {
          State: 'WY',
          Age: '14 to 17 Years',
          Population: 9314
        },
        {
          State: 'DC',
          Age: 'Under 5 Years',
          Population: 30352
        },
        {
          State: 'DC',
          Age: '5 to 13 Years',
          Population: 20439
        },
        {
          State: 'DC',
          Age: '14 to 17 Years',
          Population: 10225
        },
        {
          State: 'VT',
          Age: 'Under 5 Years',
          Population: 38253
        },
        {
          State: 'VT',
          Age: '5 to 13 Years',
          Population: 42538
        },
        {
          State: 'VT',
          Age: '14 to 17 Years',
          Population: 15757
        },
        {
          State: 'ND',
          Age: 'Under 5 Years',
          Population: 51896
        },
        {
          State: 'ND',
          Age: '5 to 13 Years',
          Population: 67358
        },
        {
          State: 'ND',
          Age: '14 to 17 Years',
          Population: 18794
        },
        {
          State: 'AK',
          Age: 'Under 5 Years',
          Population: 72083
        },
        {
          State: 'AK',
          Age: '5 to 13 Years',
          Population: 85640
        },
        {
          State: 'AK',
          Age: '14 to 17 Years',
          Population: 22153
        }
      ]
    }
  ],
  xField: 'State',
  yField: 'Population',
  seriesField: 'Age',
  stack: false,
  legends: {
    visible: true
  },
  bar: {
    // The state style of bar
    state: {
      hover: {
        stroke: '#000',
        lineWidth: 1
      }
    },
    
  }
};</br>
```
## 结果展示 

在线效果参考：https://codesandbox.io/s/bar-chart-stack-false-cr6667</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QLSpbJbrfoK3wFx1k5rc3iURnPb.gif' alt='' width='756' height='640'>



## 相关文档

堆积柱形图demo：https://www.visactor.io/vchart/demo/bar-chart/stack-column</br>
柱形图教程：https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Bar</br>
相关api：https://www.visactor.io/vchart/option/barChart#stack</br>
github：https://github.com/VisActor/VChart</br>



