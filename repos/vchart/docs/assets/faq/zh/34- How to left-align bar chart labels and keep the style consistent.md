---
title: 11. 如何实现条形图标签左对齐，标签的样式保持一致</br>
---
## 问题标题

如何实现条形图标签左对齐，标签的样式保持一致？</br>


## 问题描述

如图，条形图中的标签可以实现左对齐样式吗？另外为什么标签的样式不是完全一样的</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Xi3wb8JMPoAVqKxgA6FcJnGtnxe.gif' alt='' width='656' height='1088'>

## 解决方案 

*  标签的位置可以通过`label.position`进行配置，条形图默认标签在图形外侧，所以没有左对齐，通过设置`label.position`为`inside-left`就可以实现左对齐效果了</br>
*  当条形图标签位置为`inside-left`的时候，会开启**智能反色** ，可能会带来样式不一致的问题，可以手动关闭智能翻色</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TDcWbVB3YoIpzaxKmAzceEnknHc.gif' alt='' width='2686' height='1262'>

## 代码示例  

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'Apple',
          value: 214480
        },
        {
          name: 'Google',
          value: 155506
        },
        {
          name: 'Amazon',
          value: 100764
        },
        {
          name: 'Microsoft',
          value: 92715
        },
        {
          name: 'Coca-Cola',
          value: 66341
        },
        {
          name: 'Samsung',
          value: 59890
        },
        {
          name: 'Toyota',
          value: 53404
        },
        {
          name: 'Mercedes-Benz',
          value: 48601
        },
        {
          name: 'Facebook',
          value: 45168
        },
        {
          name: "McDonald's",
          value: 43417
        },
        {
          name: 'Intel',
          value: 43293
        },
        {
          name: 'IBM',
          value: 42972
        },
        {
          name: 'BMW',
          value: 41006
        },
        {
          name: 'Disney',
          value: 39874
        },
        {
          name: 'Cisco',
          value: 34575
        },
        {
          name: 'GE',
          value: 32757
        },
        {
          name: 'Nike',
          value: 30120
        },
        {
          name: 'Louis Vuitton',
          value: 28152
        },
        {
          name: 'Oracle',
          value: 26133
        },
        {
          name: 'Honda',
          value: 23682
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'value',
  yField: 'name',
  axes: [
    {
      orient: 'bottom',
      visible: false
    }
  ],
  label: {
    visible: true,
    position: 'inside-left',
    smartInvert: false,
  }
};</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/M3yWbPRy9oqHANxbgc6cAckUnLe.gif' alt='' width='532' height='1056'>

## 相关文档

智能反色配置：https://visactor.com/vchart/option/barChart#label.smartInvert</br>
标签配置： https://visactor.com/vchart/option/barChart#label.position</br>
github：https://github.com/VisActor/VChart</br>

