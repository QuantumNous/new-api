---
title: 39. VChart 如何配置饼图大小</br>
---
## 问题标题

 VChart 如何配置饼图大小？</br>


## 问题描述

页面较窄，VChart 如何调整配置，使得饼图尽可能占满屏幕空间</br>


## 解决方案

1. 取消默认的图表边距。</br>
VChart 默认为所有图表设置了一定的边距，你可以配置 `padding: 0` 取消默认边距。</br>
1. 调整饼图扇区外半径。</br>
默认情况下，饼图并不会撑满整个画布，你可以通过配置 `outerRadius: 1` ，将外半径占比设置为最高。</br>


## 代码示例 

```
const data = [
  { value: 10, category: 'One' },
  { value: 9, category: 'Two' },
  { value: 6, category: 'Three' },
  { value: 5, category: 'Four' },
  { value: 4, category: 'Five' },
  { value: 3, category: 'Six' },
  { value: 1, category: 'Seven' }
];

const spec = {
  type: 'pie',
  data: [
    {
      id: 'pie',
      values: data
    }
  ],
  outerRadius:1,
  padding:0,
  background:'#eeeeee',
  categoryField: 'category',
  valueField: 'value',
  
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/LiJHb2VCzoHABdxL5NvccgYknzg.gif' alt='' width='1677' height='1044'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/L3irbGIlfoGvsFxXQ0tcqZyxnqc.gif' alt='' width='1677' height='1044'>

## 相关文档

*  [饼图配置项](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FpieChart%23outerRadius)</br>
*  github：https://github.com/VisActor/VChart</br>

