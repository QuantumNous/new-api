---
title: 83. VChart  饼图如何设置默认选中一个区域？</br>
---
## 问题标题

VChart  饼图如何设置默认选中一个区域？</br>


## 问题描述

饼图第一次绘制的时候，希望能够突出显示一个区块，该如何配置？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/CQA7bNAUjoNeyQxFKZ2cylYmnNd.gif' alt='' width='336' height='346'>

## 解决方案



1. 首先，需要在图表 spec 配置中，设置 selected 状态下的图形样式：</br>
```
 pie: {
    state: {
      selected: { 
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },</br>
```
1. 通过 setSelected API 来设置默认选中的数据项</br>
```
const vchart = new VChart(spec, { dom });
vchart.renderSync();
vchart.setSelected({
    // one data record
})</br>
```
## 代码示例 

```
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    state: {
      selected: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
 
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

vchart.setSelected({ type: 'oxygen'})

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HOnJbPcH0oVnvtx9Vp8cUQ8xnag.gif' alt='' width='1662' height='1044'>

## 相关文档

*  github：https://github.com/VisActor/VChart</br>
*  相关 demo：https://visactor.io/vchart/demo/pie-chart/ring</br>



