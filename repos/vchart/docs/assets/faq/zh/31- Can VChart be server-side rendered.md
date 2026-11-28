---
title: 45. VChart 可以服务端渲染吗</br>
---
## 问题标题

可以服务端渲染吗</br>
## 问题描述

可以服务端渲染吗？想要在服务端提供获取图表图片的服务。</br>
## 解决方案 

VChart 支持Node服务端渲染。VChart 使用的绘图库 VRender 支持了Node环境渲染。除了 VChart 外，只需要在服务端安装 [canvas](https%3A%2F%2Fwww.npmjs.com%2Fpackage%2Fcanvas) 包即可。</br>


## 代码示例  

```
const fs = require('fs');

const VChart = require('@visactor/vchart');
const Canvas = require('canvas');

// 正常的图表 spec 配置
const spec = {
  type: 'radar',
  data: [
    {
      id: 'Map',
      values: [
        { key: 'North', value: 31, category: 'Destroyer' },
        { key: 'Northeast', value: 32, category: 'Destroyer' },
        { key: 'East', value: 21, category: 'Destroyer' },
        { key: 'Southeast', value: 15, category: 'Destroyer' },
        { key: 'South', value: 50, category: 'Destroyer' },
        { key: 'Southwest', value: 44, category: 'Destroyer' },
        { key: 'West', value: 32, category: 'Destroyer' },
        { key: 'Northwest', value: 32, category: 'Destroyer' },
        { key: 'North', value: 31, category: 'Destroyer' },
        { key: 'Northeast', value: 32, category: 'Destroyer' },
        { key: 'East', value: 21, category: 'Destroyer' },
        { key: 'Southeast', value: 40, category: 'aircraft carrier' },
        { key: 'South', value: 25, category: 'aircraft carrier' },
        { key: 'Southwest', value: 22, category: 'aircraft carrier' },
        { key: 'West', value: 18, category: 'aircraft carrier' },
        { key: 'Northwest', value: 7, category: 'aircraft carrier' },
        { key: 'North', value: 24, category: 'aircraft carrier' },
        { key: 'Northeast', value: 43, category: 'aircraft carrier' },
        { key: 'East', value: 42, category: 'aircraft carrier' }
      ]
    }
  ],
  categoryField: 'key',
  valueField: 'value',
  seriesField: 'category',
  legends: {
    visible: true,
    orient: 'bottom'
  }
};
const cs = new VChart.default(spec, {
  // 声明使用的渲染环境以及传染对应的渲染环境参数
  mode: 'node',
  modeParams: Canvas,
  animation: false // 关闭动画
});

cs.renderSync();

// 导出图片
const buffer = cs.getImageBuffer();
fs.writeFileSync(`./chart.png`, buffer);</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/C1rFbrJnboheEyxQYf6cBYywnkh.gif' alt='' width='500' height='500'>

Demo: https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/node</br>
## 相关文档

Demo：https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/node</br>
教程：</br>
*  初始化VChart： https://visactor.io/vchart/api/API/vchart</br>
*  Node服务端渲染教程：https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/node</br>
Github：https://github.com/VisActor/VChart/</br>



