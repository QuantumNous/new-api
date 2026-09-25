---
title: 43. VChart 怎么配置嵌套饼图</br>
---
## 问题标题

如何配置嵌套饼图</br>
## 问题描述

如何配置嵌套饼图</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/X5rvbMnx4oUs28xpfGMcSTy3nue.gif' alt='' width='3572' height='2454'>

## 解决方案 

VChart 可以配置多个 pie-series 然后将它们的半径配置为：内圈的外半径 = 外圈的内半径，这样就能实现嵌套饼图</br>
还有类似嵌套饼图的玫瑰图，可以选择根据业务场景选择。</br>
*  outerRadius: number // 外半径，百分比数值</br>
*  innerRadius: number // 内半径，百分比数值</br>


## 代码示例  

```
const spec = {
  type: 'common',
  data: [
    {
      id: 'id0',
      values: [
        { type: '0~29', value: '126.04' },
        { type: '30~59', value: '128.77' },
        { type: '60 and over', value: '77.09' }
      ]
    },
    {
      id: 'id1',
      values: [
        { type: '0~9', value: '39.12' },
        { type: '10~19', value: '43.01' },
        { type: '20~29', value: '43.91' },
        { type: '30~39', value: '45.4' },
        { type: '40~49', value: '40.89' },
        { type: '50~59', value: '42.48' },
        { type: '60~69', value: '39.63' },
        { type: '70~79', value: '25.17' },
        { type: '80 and over', value: '12.29' }
      ]
    }
  ],
  series: [
    {
      type: 'pie',
      dataIndex: 0,
      outerRadius: 0.65,
      innerRadius: 0,
      valueField: 'value',
      categoryField: 'type',
      label: { position: 'inside', visible: true }
    },
    {
      type: 'pie',
      dataIndex: 1,
      outerRadius: 0.8,
      innerRadius: 0.67,
      valueField: 'value',
      categoryField: 'type',
      label: {
        visible: true
      }
    }
  ],
  color: ['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00'],
  legends: {
    visible: true,
    orient: 'left'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/V6MPbbC1koZZFVxP1dEc0f5ynHc.gif' alt='' width='1339' height='540'>

Demo: https://codesandbox.io/p/sandbox/vchart-disabletriggerevent-forked-xkzpxq?file=%2Fsrc%2Findex.js%3A43%2C31</br>
## 相关文档

Demo：https://codesandbox.io/p/sandbox/vchart-disabletriggerevent-forked-xkzpxq?file=%2Fsrc%2Findex.js%3A43%2C31</br>
教程：</br>
*  初始化VChart： https://visactor.io/vchart/api/API/vchart</br>
*  饼图半径配置：https://www.visactor.io/vchart/option/pieChart#outerRadius</br>
*  玫瑰图：https://www.visactor.io/vchart/demo/rose-chart/rose-stacked?keyword=roseChart</br>
Github：https://github.com/VisActor/VChart/</br>



