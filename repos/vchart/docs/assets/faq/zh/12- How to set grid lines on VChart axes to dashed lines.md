---
title: 38. VChart 坐标轴网格线如何设置为虚线</br>
---
## 问题标题

VChart 坐标轴网格线如何设置为虚线？</br>


## 问题描述

VChart 里坐标轴的网格线是直线，如何设置为虚线，以及如何调整虚线的样式？</br>


## 解决方案

在 VChart 里，坐标轴网格线样式的配置项是 `axes[i].grid.style`。你可以通过配置 `lineDash` 属性将实线调整为你想要的虚线效果。</br>
`lineDash`使用一组值来指定描述模式的线和间隙的交替长度。例如：</br>
```
lineDash: [2, 3]; 
// 切换回至实线模式
lineDash: [0];</br>
```


## 代码示例 

```
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  axes:[
    {
      orient:'left',
      grid:{
        style:{
          stroke:"black",
          lineDash:[5,5]
        }
      }
    },
    {
      orient:'bottom',
      grid:{
        visible: true,
        style:{
          stroke:"black",
          lineDash:[5,5]
        }
      }
    }
  ],
  xField: 'time',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/H8Upbvn30omSSux10LncnhaSnGc.gif' alt='' width='1677' height='1044'>



## 相关文档

*  [lineDash 配置项目](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FbarChart-extensionMark-symbol%23style.lineDash(number%5B%5D))</br>
*  [坐标轴教程](https%3A%2F%2Fvisactor.io%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2FAxes)</br>
*  github：https://github.com/VisActor/VChart</br>

