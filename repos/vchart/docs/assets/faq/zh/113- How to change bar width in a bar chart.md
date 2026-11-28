---
title: 74. 柱状图如何改变柱宽</br>
---
# **问题标题**

柱状图如何改变柱宽？</br>
# **问题描述**

我在使用vchart柱状图时，想要设置柱子宽度，但是在文档中没有找到相应的配置项。我试了一些参数，但是都没有成功。请问应该如何设置？</br>
# **解决方案**

vchart柱状图的柱状大小的设置，可以通过调整柱状图的宽度来实现。柱状图有一个`barWidth`属性，用于调整柱子宽度。</br>
# **示例代码**

```
const spec = {
  type: 'bar',
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
  barWidth: '60%',
  barMinWidth: 20,
  barMaxWidth: 50,
  xField: 'time',
  yField: 'value',
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
# **结果展示**

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BD6lbObJuorIPHxmG4icvDkZnrd.gif' alt='' width='1236' height='990'>

# **相关文档**

*  barWidth配置: https://visactor.bytedance.net/vchart/option/barChart#barWidth</br>
*  VChart github：https://github.com/VisActor/VChart</br>



