---
title: 19. What are the methods for formatting VChart chart labels?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

What are the methods for formatting VChart chart labels?</br>


## Description

In the VChart bar chart, the default display is the label of the corresponding value of the bar. I want to display something like `'x-axis name: y value' `. What are the ways to customize the label display?</br>


## Solution

There are two recommended configuration methods:</br>
1. Configure the formatting function through `label.formatMethod`.</br>
1. The function parameter is `(text: string | string [], data?: any) `, `text`is the default displayed text, and `data`is the related data.</br>
1. The return value of the function can be a string or a string array. Among them, the string array will be displayed as a newline by default.</br>
1. If you want to configure it as rich text, the return value is the rich text configuration object.</br>
```
label: {
    formatMethod:(value, data) => `${data.name}: ${value}`
}</br>
```
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/SsTrb0DkdoaLVBxAbTXcJFYDnre.gif' alt='' width='2842' height='894'>



1. Configure the template string through `label.formatter`.</br>
```
label: {
   formatter: `{name} : {value}`
}</br>
```
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Htc7b4aN6oCYh1xmgDec8Npnn2f.gif' alt='' width='2884' height='848'>







## Related Documents

formatMethod demo: [https://visactor.io/vchart/demo/label/richtext-label](https%3A%2F%2Fvisactor.io%2Fvchart%2Fdemo%2Flabel%2Frichtext-label)</br>
Formatter demo：[https://visactor.io/vchart/demo/label/label-formatter](https%3A%2F%2Fvisactor.io%2Fvchart%2Fdemo%2Flabel%2Flabel-formatter)</br>
Related configuration items: https://visactor.io/vchart/option/barChart#label.formatMethod</br>
github：https://github.com/VisActor/VChart</br>



