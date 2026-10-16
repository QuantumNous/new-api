---
title: 92.折线图支持按照y轴分段设置背景颜色吗</br>
---
## 问题标题

折线图支持按照y轴分段设置背景颜色吗</br>
## 问题描述

下面的线图中， 支持按照y轴分段设置背景颜色吗</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/MD6lbNVHZoD4sNxBpPPcDcvGn9f.gif' alt='' width='1496' height='1040'>

## 解决方案

有两种方案可以实现这里的背景色需求</br>
*  方案一：可以通过配置`axes.grid.alternateColor`来设置网格填充颜色：</br>
```
axes: [
    {
      orient: 'left',
      grid: {
        alternateColor: [
          'rgba(0, 255, 0, 0.3)', 
          'rgba(255, 0, 0, 0.2)',
          'rgba(0, 0, 255, 0.2)'
          ]
      }
    }
  ]</br>
```
方案二： VChart支持多种标注组件，其中`markArea`可以用于配置标注区块，所以我们可以通过下面的方式配置背景色块</br>
```
markArea: [
    {
      y: 0,
      y1: 5,
      area: {
        style: {
          fill: 'red',
          fillOpacity: 0.2
        }
      }
    },

    {
      y: 5,
      y1: 10,
      area: {
        style: {
          fill: 'yellow',
          fillOpacity: 0.2
        }
      }
    },

    {
      y: 10,
      y1: 15,
      area: {
        style: {
          fill: 'pink',
          fillOpacity: 0.2
        }
      }
    },

    {
      y: 15,
      y1: 20,
      area: {
        style: {
          fill: 'green',
          fillOpacity: 0.2
        }
      }
    },
   ]</br>
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
  xField: 'time',
  yField: 'value',
  markArea: [
    {
      y: 0,
      y1: 5,
      area: {
        style: {
          fill: 'red',
          fillOpacity: 0.2
        }
      }
    },

    {
      y: 5,
      y1: 10,
      area: {
        style: {
          fill: 'yellow',
          fillOpacity: 0.2
        }
      }
    },

    {
      y: 10,
      y1: 15,
      area: {
        style: {
          fill: 'pink',
          fillOpacity: 0.2
        }
      }
    },

    {
      y: 15,
      y1: 20,
      area: {
        style: {
          fill: 'green',
          fillOpacity: 0.2
        }
      }
    },
   ]
};</br>
```
## 结果展示



<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/O5RjbhBCUoY8c5xH8oTcj7BGnVg.gif' alt='' width='1474' height='1070'>

## 相关文档

*  [github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>
*  [Marker数据标注教程](https%3A%2F%2Fvisactor.com%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2Fmarker)</br>
*  [MarkArea配置文档](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FlineChart%23markArea)</br>