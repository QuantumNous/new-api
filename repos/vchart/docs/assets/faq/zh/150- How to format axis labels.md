---
title: 5. 如何对轴标签进行格式化？</br>
---
## 问题标题

如何对轴标签进行格式化？</br>


## 问题描述

如图，当轴标签数值精度有问题，非常长的时候，可以进行格式化吗？</br>


<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/B6B9bdM7TordLuxQ9W7c2i7pn9f.gif' alt='' width='1516' height='1076'>

## 解决方案 

这里产生浮点数精度问题是因为在实现坐标轴刻度对齐的时候，进行浮点数的加法运算带来的。为了提高轴标签的可读性，可以通过`label.formatMethod`对轴标签进行格式化处理。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/P6YGbGl8eoVeBSxZjP0cQEo1nwf.gif' alt='' width='3502' height='1240'>

## 代码示例  

```
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: '周一', type: '早餐', y: 0.1633 },
      ]
    },
    {
      id: 'id1',
      values: [
        { x: '周一', type: '饮料', y: -0.3455 },
       
      ]
    }
  ],
  series: [
    {
      type: 'line',
      id: 'line',
      dataIndex: 0,
      label: { visible: true },
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0], id: 'left' },
    { 
      orient: 'right', 
      seriesId: ['line'], 
      grid: { visible: false }, 
      label: {
        formatMethod: (label) => {
          return Math.round(label * 100) / 100;
        }
      },
      sync: {
        axisId: 'left',
        tickAlign: true
      } 
    },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/NBaibyqbzoWrQYx9XDkce4xUnrh.gif' alt='' width='1552' height='1034'>

## 相关文档

相关配置：https://www.visactor.io/vchart/option/barChart-axes-linear#label.formatMethod</br>
Axes坐标轴教程: https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes</br>
github：https://github.com/VisActor/VChart</br>