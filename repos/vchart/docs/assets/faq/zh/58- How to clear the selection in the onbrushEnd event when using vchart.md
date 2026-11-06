---
title: 55. 如何在使用vchart时，在onbrushEnd事件最后清除框选？</br>
---
# 问题标题

如何在使用vchart时，在onbrushEnd事件最后清除框选？</br>


# 问题描述

我正在使用@visactor/vchart图表库进行图表开发，遇到了一个问题，我需要在onbrushEnd事件最后清除brush的框选，但是目前我没有找到合适的api来实现这个需求。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TtJhbirfsoI83Extdf9cQ69Fnud.gif' alt='' width='1876' height='1106'>

# 解决方案

目前确实没有直接对应这个需求的api，但是这里有一个较为特殊的实现方式可以求解该问题，具体代码如下：</br>


```
cs.on('brushEnd', (params) => {
cs.getChart()?.getAllComponents().forEach(c => {
if(c.name === 'brush') {
c?._brushComponents?.forEach(c => c._container.incrementalClearChild())
}
})
})</br>
```
以上解决方案是当触发'brushEnd'事件后，获取所有的组件，并遍历这些组件，如果某个组件名为'brush'，就清除该组件。</br>


# 结果展示

代码运行后，可以实现在onbrushEnd事件结束后清除框选。</br>
在线demo：https://codesandbox.io/p/sandbox/grouped-bar-chart-shows-all-the-group-labels-forked-2t4jf7</br>


# 相关文档

*  VisActor官网：https://www.visactor.io/</br>
*  VChart事件：https://www.visactor.io/vchart/api/API/event</br>