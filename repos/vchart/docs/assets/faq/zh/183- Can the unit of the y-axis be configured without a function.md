---
title: 29.不用函数能配置 y 轴的单位吗</br>
---
## 问题标题

不用函数能配置 y 轴的单位吗？</br>


## 问题描述

请问一下不使用函数能支持 y 轴的格式化吗？比如一些默认的千分位，自动加单位这些。因为小程序场景里头里面只能用纯 json 配置，没法配置回调函数。</br>


## 解决方案

从 VChart 1.7.0版本开始，可以通过注册表达式函数的方法对自定义的函数内容进行注册：</br>
```
function labelFormat(key) {
  return key + 'test';
}

// Global registration function
VChart.registerFunction('labelFormat', labelFormat);</br>
```
对应的图表配置中可以在任意支持自定义回调函数的地方使用这一注册函数的名称：</br>
```
const spec = {
  type: 'bar',
  data: [...],
  xField: 'month',
  yField: 'sales',
  label: {
    visible: true,
    formatMethod: 'labelFormat'
  }
};</br>
```
注册函数的功能在飞书小组件以及微信小程序等环境中均可生效。</br>


## 代码示例 

```
function labelFormat(key) {
  return key + 'test';
}

// Global registration function
VChart.registerFunction('labelFormat', labelFormat);

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  label: {
    visible: true,
    formatMethod: 'labelFormat'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
</br>
```


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OJd9bVlGAoTGPVxbAYWctU0bn8b.gif' alt='' width='1222' height='984'>



## 相关文档

*  function：https://www.visactor.io/vchart/guide/tutorial_docs/Function</br>
*  github：https://github.com/VisActor/VChart</br>

