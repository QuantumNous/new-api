---
title: 66.如何设置X轴和Y轴标签的最大数量？</br>
---
## 问题标题

如何设置X轴和Y轴标签的最大数量？</br>


## 问题描述

下面的图表中，x轴的标签展示的比较密集，可以限制标签的最大数量吗？让x轴标签视觉上更好，同时点的线上的点都需要展示</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/US4jb7yuno8WMZxjdXDc9GYwn4f.gif' alt='' width='1362' height='1032'>

## 解决方案 

VChart中，轴标签的个数受多种配置的影响，有两种办法限制轴标签的个数：</br>
*  `sampling`设置为`true`，这样会根据标签的宽度，自动抽样</br>
*  `tick.tickCount`设置标签个数</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AWphbwooco1VBdxWZ7XchRXinrc.gif' alt='' width='3528' height='1268'>

## 代码示例  

```
const spec = {
  type: 'line',
  data: {
    values: [
      {
        medalType: 'Gold Medals',
        count: 40,
        year: '1952'
      },
      {
        medalType: 'Gold Medals',
        count: 32,
        year: '1956'
      },
      {
        medalType: 'Gold Medals',
        count: 34,
        year: '1960'
      },
      {
        medalType: 'Gold Medals',
        count: 36,
        year: '1964'
      },
      {
        medalType: 'Gold Medals',
        count: 45,
        year: '1968'
      },
      {
        medalType: 'Gold Medals',
        count: 33,
        year: '1972'
      },
      {
        medalType: 'Gold Medals',
        count: 34,
        year: '1976'
      },
      {
        medalType: 'Gold Medals',
        count: null,
        year: '1980'
      },
      {
        medalType: 'Gold Medals',
        count: 83,
        year: '1984'
      },
      {
        medalType: 'Gold Medals',
        count: 36,
        year: '1988'
      },
      {
        medalType: 'Gold Medals',
        count: 37,
        year: '1992'
      },
      {
        medalType: 'Gold Medals',
        count: 44,
        year: '1996'
      },
      {
        medalType: 'Gold Medals',
        count: 37,
        year: '2000'
      },
      {
        medalType: 'Gold Medals',
        count: 35,
        year: '2004'
      },
      {
        medalType: 'Gold Medals',
        count: 36,
        year: '2008'
      },
      {
        medalType: 'Gold Medals',
        count: 46,
        year: '2012'
      },
      {
        medalType: 'Silver Medals',
        count: 19,
        year: '1952'
      },
      {
        medalType: 'Silver Medals',
        count: 25,
        year: '1956'
      },
      {
        medalType: 'Silver Medals',
        count: 21,
        year: '1960'
      },
      {
        medalType: 'Silver Medals',
        count: 26,
        year: '1964'
      },
      {
        medalType: 'Silver Medals',
        count: 28,
        year: '1968'
      },
      {
        medalType: 'Silver Medals',
        count: 31,
        year: '1972'
      },
      {
        medalType: 'Silver Medals',
        count: 35,
        year: '1976'
      },
      {
        medalType: 'Silver Medals',
        count: null,
        year: '1980'
      },
      {
        medalType: 'Silver Medals',
        count: 60,
        year: '1984'
      },
      {
        medalType: 'Silver Medals',
        count: 31,
        year: '1988'
      },
      {
        medalType: 'Silver Medals',
        count: 34,
        year: '1992'
      },
      {
        medalType: 'Silver Medals',
        count: 32,
        year: '1996'
      },
      {
        medalType: 'Silver Medals',
        count: 24,
        year: '2000'
      },
      {
        medalType: 'Silver Medals',
        count: 40,
        year: '2004'
      },
      {
        medalType: 'Silver Medals',
        count: 38,
        year: '2008'
      },
      {
        medalType: 'Silver Medals',
        count: 29,
        year: '2012'
      },
      {
        medalType: 'Bronze Medals',
        count: 17,
        year: '1952'
      },
      {
        medalType: 'Bronze Medals',
        count: 17,
        year: '1956'
      },
      {
        medalType: 'Bronze Medals',
        count: 16,
        year: '1960'
      },
      {
        medalType: 'Bronze Medals',
        count: 28,
        year: '1964'
      },
      {
        medalType: 'Bronze Medals',
        count: 34,
        year: '1968'
      },
      {
        medalType: 'Bronze Medals',
        count: 30,
        year: '1972'
      },
      {
        medalType: 'Bronze Medals',
        count: 25,
        year: '1976'
      },
      {
        medalType: 'Bronze Medals',
        count: null,
        year: '1980'
      },
      {
        medalType: 'Bronze Medals',
        count: 30,
        year: '1984'
      },
      {
        medalType: 'Bronze Medals',
        count: 27,
        year: '1988'
      },
      {
        medalType: 'Bronze Medals',
        count: 37,
        year: '1992'
      },
      {
        medalType: 'Bronze Medals',
        count: 25,
        year: '1996'
      },
      {
        medalType: 'Bronze Medals',
        count: 33,
        year: '2000'
      },
      {
        medalType: 'Bronze Medals',
        count: 26,
        year: '2004'
      },
      {
        medalType: 'Bronze Medals',
        count: 36,
        year: '2008'
      },
      {
        medalType: 'Bronze Medals',
        count: 29,
        year: '2012'
      }
    ]
  },
  xField: 'year',
  yField: 'count',
  seriesField: 'medalType',
  invalidType: 'link',
  axes: [
    {
      orient: 'bottom',
      tick: {
        tickCount: 5
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/O1TwbmurkogF6Pxrgehc23BJnVe.gif' alt='' width='1384' height='1060'>

## 相关文档

*  [Axes  坐标轴教程](https%3A%2F%2Fwww.visactor.io%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2FAxes)</br>
*  [VChart github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>

