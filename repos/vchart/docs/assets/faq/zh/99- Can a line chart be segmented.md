---
title: 71. 折线图能分段吗？</br>
---
# 问题标题

折线图能分段吗？</br>
# 问题描述

vchart折线图有个点不想显示，能让折线图分段吗？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Awlfbudq1o4LVFx7rs3cxBQxnWg.gif' alt='' width='1036' height='726'>

# 解决方案

如果某个点的值不合法，VChart会默认屏蔽掉这个点，可以将数据中的这个点对应的value设置为null即可。</br>
比如下面数据10:00对应的点就不会显示了</br>
```
data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: null
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  }</br>
```
# 代码示例  

```
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: null
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
# 结果展示

代码运行后，10:00对应的点就不会显示了，折线就分段了</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/M5IEbg02OoW0yLxYiYxcO1LknUd.gif' alt='' width='1000' height='578'>

在线demo：https://codesandbox.io/p/sandbox/line-point-split-fq7wkh?file=%2Fsrc%2Findex.ts%3A49%2C2</br>
# 相关文档

*  VChart 的官网：https://visactor.io/vchart/</br>
*  VChart github：https://github.com/VisActor/VChart</br>