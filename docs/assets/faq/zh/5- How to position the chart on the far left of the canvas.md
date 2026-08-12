---
title: 10. 怎么让图在canvas的最左边? </br>
---
# 问题标题

在vchart图表库中如何让图表位于canvas的最左边？</br>


# 问题描述

我正在使用vchart图表库进行可视化操作，我希望图表能位于canvas的最左边，然而我尝试调整配置的时候出了问题，不知道应该如何设置。</br>
```
{
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
        value: 16
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
  yField: 'value',
  axes:[
    {
      type:'band',
      orient:'bottom',
      visible:false,
    },
    {
      orient:'left',
      visible:false,
    }
  ]
};</br>
```
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DPyKbpPRcoH3yfxChmmciWv6nQh.gif' alt='' width='760' height='420'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TQGcbgF0xooBWoxDxOIc7lq9nZc.gif' alt='' width='680' height='704'>



# 解决方案

在vchart的配置项中有一个`trimPadding`属性，该属性用于配置是否去除 band 轴两端的留白，如果为`true`，则两端不会有留白，并且`bandPadding`、`paddingInner` 和 `paddingOuter` 的设置将被忽略。</br>


而在这里，我们需要的是将图表放置在canvas的最左边，即没有左边的留白，那么我们需要在`'bottom'`轴上加上`trimPadding`配置。</br>


以下是配置的示例：</br>
```
{
//...省略spec配置
  axes:[
    {
      type:'band',
      orient:'bottom',
      visible:false,
      trimPadding:true,
    },
    {
      orient:'left',
      visible:false,
    }
  ]
};</br>
```
# 结果展示

通过添加`trimPadding`配置后，图表现在已经可以正常显示在canvas的最左边了。</br>
在线效果参考：https://codesandbox.io/p/sandbox/common-chart-interactive-forked-cn95kp</br>


# 相关文档

相关API：[https://visactor.bytedance.net/vchart/option/barChart-axes-band#trimPadding](https%3A%2F%2Fvisactor.bytedance.net%2Fvchart%2Foption%2FbarChart-axes-band%23trimPadding)</br>
github：https://github.com/VisActor/VChart</br>