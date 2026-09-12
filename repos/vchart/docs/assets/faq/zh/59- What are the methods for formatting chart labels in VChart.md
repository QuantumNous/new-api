---
title: 19. VChart 图表标签格式化的方法有哪些？</br>
---
## 问题标题

VChart 图表标签格式化的方法有哪些？</br>
## 问题描述

VChart 柱状图中，默认展示的是柱子对应数值的标签，我想展示类似 ``x轴名称: y数值``这样的内容，有哪些办法可以自定义标签展示？</br>
## 解决方案 

有两种推荐的配置方式：</br>
1. 通过 `label.formatMethod` 配置格式化函数。</br>
1. 函数参数为`(text: string | string[], datum?: any)`，`text` 为默认展示的文本，`datum`为图元数据。</br>
1. 函数返回值可以是一个字符串或字符串数组。其中，字符串数组会默认换行展示。</br>
1. 如果要配置为富文本，那么返回值则为富文本配置对象；</br>
```
label: {
    formatMethod:(value, data) => `${data.name}: ${value}`
}</br>
```
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Lu0IbhIOtoCTHOxlZUAcGF6nn9e.gif' alt='' width='2842' height='894'>



1. 通过 `label.formatter` 配置模板字符串。</br>
```
label: {
   formatter: `{name} : {value}`
}</br>
```
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JgcTblmKqorPmZxREk4chim4nLg.gif' alt='' width='2884' height='848'>





## 相关文档

formatMethod demo: [https://visactor.io/vchart/demo/label/richtext-label](https%3A%2F%2Fvisactor.io%2Fvchart%2Fdemo%2Flabel%2Frichtext-label)</br>
Formatter demo：[https://visactor.io/vchart/demo/label/label-formatter](https%3A%2F%2Fvisactor.io%2Fvchart%2Fdemo%2Flabel%2Flabel-formatter)</br>
相关配置项：https://visactor.io/vchart/option/barChart#label.formatMethod</br>
github：https://github.com/VisActor/VChart</br>



