---
title: 71. 柱系列是否可以监听事件回调？</br>
---
## 问题标题

柱系列是否可以监听事件回调？</br>
## 问题描述

小程序使用 VChart 柱状图时，在选中柱状图某个柱时，是否有事件可以回调？</br>


## 解决方案 

在vchart中，您可以通过监听pointerdown事件来获取当前点击的图元信息；此外，还可以通过事件过滤获取不同元素上的事件。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/IUGQbR1r7oc2Pdxp3IdcwcCIngg.gif' alt='' width='2628' height='1926'>



<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Ebb4b1dzBoReqoxfpbPcZL4InCh.gif' alt='' width='1392' height='1488'>

## 代码示例  

```
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
  yField: 'sales'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
vchart.on('pointerdown', { level: 'mark' }, (...params) => console.log(params))

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

在线效果参考：https://codesandbox.io/p/sandbox/bar-event-listener-dt8pjg?file=%2Fsrc%2Findex.ts%3A26%2C5</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JaQdb5qiao66z6xRd2wcpy0bnZc.gif' alt='' width='1392' height='1488'>

## 相关文档

事件教程：https://www.visactor.io/vchart/guide/tutorial_docs/Event</br>
相关api：https://www.visactor.io/vchart/api/API/event</br>
github：https://github.com/VisActor/VChart</br>



