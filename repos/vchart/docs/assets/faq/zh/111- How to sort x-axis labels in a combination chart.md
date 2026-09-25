---
title: 33.组合图如何实现对x轴的标签进行排序排序？</br>
---
# 问题标题

组合图如何实现对x轴的标签进行排序排序？</br>


## 问题描述

下面的组合图中，x轴标签没有按照时间进行排序，可以通过`sortDataByAxis`实现排序效果吗？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/PCBjbhywNoQ1ykxDRsccBNR1n5b.gif' alt='' width='2568' height='1174'>



## 解决方案 

`sortDataByAxis` 的功能是，让系列的数据按照轴排序，但是不影响轴本身的排序，如果想要让轴上的内容按照所需顺序展示，有两种解决办法：</br>
1. 配置 data 中的 fields，设定需要展示的数据 domain 顺序：</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/MyJcb40GNouRZUxtNjucH9pnncd.gif' alt='' width='3406' height='1252'>

1. 提前对数据按照展示顺序做排序</br>


## 代码示例  

```
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      fields: {
        x: {
          domain: ['2024-03-20', '2024-03-21', '2024-03-22', '2024-03-23', '2024-03-24', '2024-03-25', '2024-03-26'],
          sortIndex: 0
        }
      },
      values: [
        { x: '2024-03-21', type: '需求建议', y: 14 },
        { x: '2024-03-21', type: '功能缺陷', y: 27 },
        { x: '2024-03-21', type: '其他', y: 1 },
        { x: '2024-03-21', type: '操作咨询', y: 16 },
        { x: '2024-03-26', type: '功能缺陷', y: 26 },
        { x: '2024-03-26', type: '需求建议', y: 9 },
        { x: '2024-03-26', type: '操作咨询', y: 17 },
        { x: '2024-03-26', type: '其他', y: 1 },
        { x: '2024-03-25', type: '功能缺陷', y: 23 },
        { x: '2024-03-25', type: '操作咨询', y: 19 },
        { x: '2024-03-25', type: '需求建议', y: 11 },
        { x: '2024-03-22', type: '需求建议', y: 6 },
        { x: '2024-03-22', type: '功能缺陷', y: 22 },
        { x: '2024-03-22', type: '操作咨询', y: 14 },
        { x: '2024-03-22', type: '其他', y: 2 },
        { x: '2024-03-27', type: '功能缺陷', y: 16 },
        { x: '2024-03-27', type: '其他', y: 3 },
        { x: '2024-03-27', type: '需求建议', y: 8 },
        { x: '2024-03-27', type: '操作咨询', y: 8 },
        { x: '2024-03-23', type: '需求建议', y: 2 },
        { x: '2024-03-23', type: '功能缺陷', y: 2 },
        { x: '2024-03-20', type: '操作咨询', y: 2 },
        { x: '2024-03-20', type: '功能缺陷', y: 2 },
        { x: '2024-03-24', type: '需求建议', y: 1 }
      ]
    },
    {
      id: 'id1',
      fields: {
        x: {
          domain: ['2024-03-20', '2024-03-21', '2024-03-22', '2024-03-23', '2024-03-24', '2024-03-25', '2024-03-26'],
          sortIndex: 0
        }
      },
      values: [
        { x: '2024-03-21', type: '负面反馈比例', y: 55 },
        { x: '2024-03-26', type: '负面反馈比例', y: 57 },
        { x: '2024-03-25', type: '负面反馈比例', y: 62 },
        { x: '2024-03-22', type: '负面反馈比例', y: 63 },
        { x: '2024-03-27', type: '负面反馈比例', y: 57 },
        { x: '2024-03-23', type: '负面反馈比例', y: 75 },
        { x: '2024-03-20', type: '负面反馈比例', y: 75 },
        { x: '2024-03-24', type: '负面反馈比例', y: 100 }
      ]
    }
  ],
  stackSort: true,
  series: [
    {
      type: 'bar',
      id: 'bar',
      label: { visible: true },
      seriesField: 'type',
      dataIndex: 0,
      xField: 'x',
      yField: 'y',
      stack: true,
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0] },
    {
      orient: 'right',
      seriesId: ['line'],
      gird: { visible: false },
      min: 0,
      max: 100,
      title: { visible: true, text: '%', position: 'start' }
    },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: { visible: true, orient: 'bottom' }
};</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/GYyobZqIzoySnjxYZbCcmwl6nXU.gif' alt='' width='1602' height='1060'>

## 相关文档

*  [数据类型与数据定义教程](https%3A%2F%2Fwww.visactor.com%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2FData%2FData_Types_and_Interface)</br>
*  [VChart github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>

