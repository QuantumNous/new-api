---
title: 35. vchart多线图能否限制默认渲染的线条？</br>
---
# 问题标题

vchart多线图能否限制默认渲染的线条？</br>


# 问题描述

在使用vchart的时候，我碰到了一个问题。我正在制作一个多线图，我想问一下这个多线图可以限制默认渲染的线条吗？比如我只想让它默认渲染一条线条，这个可以实现吗？</br>


# 解决方案

可以实现这个功能。需要使用配置项`legends.defaultSelected`来设置图例初始化时默认选中的图例项。数组中的元素为图例项的 `name`。比如你可以设置`defaultSelected: ['Type D']`，表示默认渲染图例项名为'Type D' 的线条。以下是一个完整的代码示例：</br>


```
const spec = {
type: 'line',
data: [
{
id: 'line',
values: data
}
],
xField: 'year',
yField: 'value',
seriesField: 'name',
legends: {
orient: 'right',
selectMode: 'single', // Configure legend selection mode
defaultSelected: ['Type D'],
title: {
visible: true,
text: 'Single Select'
}
},
axes: [
{
orient: 'left',
label: {
inside: true,
space: 2,
style: {
textBaseline: 'bottom',
textAlign: 'start',
fontWeight: 'bold'
}
},
tick: {
visible: false
},
domainLine: {
visible: false
},
title: {
visible: true,
text: 'Axis Title'
}
}
]
};</br>
```


# 结果展示

代码运行后，多线图将默认只渲染出了'Type D'的线条。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/LFf1b3fRho1B0Yx7SLxc122lnRf.gif' alt='' width='1496' height='1048'>

在线demo：https://codesandbox.io/p/sandbox/line-chart-legend-shape-and-color-forked-gq3gcv</br>
# 相关文档

*  VChart defaultSelected配置项：https://visactor.bytedance.net/vchart/option/barChart-legends-discrete#defaultSelected</br>
*  VChart github：https://github.com/VisActor/VChart</br>

