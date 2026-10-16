---
title: 32. 如何在vchart图表库中实现点的hover效果？</br>
---
# 问题标题

如何在vchart图表库中实现点的hover效果？</br>


# 问题描述

我在使用vchart图表库进行可视化开发时遇到了一个问题。在使用lightCharts图表库时，我可以很容易地实现点的hover效果，但是当我切换到vchart图表库时，我发现用相同的配置却无法实现相同的效果。我在`series.point`中设置了点的大小，颜色等属性：</br>
```
point: { 
interactive: true, 
zIndex: 10, 
visible: true,
bar: { style: { fill: 'red', size: 10, }, }, 
state: { 
dimension_hover: { 
size: (datum: any) => { return 10; }, 
fill: (datum: any) => { return 'red'; } 
} 
} 
}</br>
```
但是在hover状态下，这些设置似乎没有生效。 我想知道我是不是遗漏了什么重要的配置或者是我的配置方式有问题。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/GT8XbqSQhobg7Ax57D2cUs5QnNZ.gif' alt='' width='1136' height='294'>

# 解决方案

以我的经验来看，你可能需要在`point`中添加`state`属性，并在`state`中添加`dimension_hover`属性来实现hover状态下的特效。具体的代码示例如下：</br>


```
point: {
style: {
size: 0
},
state: {
dimension_hover: {
size: 10,
outerBorder: {
distance: 0,
lineWidth: 6,
strokeOpacity: 0.2
}
}
}
}</br>
```


在这里，`dimension_hover`定义了当鼠标悬停在点上时的效果，你可以根据你的需要调整这些设置。</br>


你还可以参考vchart的官方demo学习相关配置： https://visactor.bytedance.net/vchart/demo/area-chart/stacked-dash-area 。如果需要在线演示或者编辑你的代码，vchart官网编辑器和codesandbox都是很好的选择。你可以在这些平台上传你的代码，并将链接发给我们，我们会为你提供进一步的帮助。</br>


# 结果展示

通过以上方法成功实现了在vchart中的点的hover效果，并找出了原先配置不生效的原因——在`series.point`中的配置冲突了。</br>
在线效果参考：https://codesandbox.io/p/sandbox/line-chart-shows-on-the-left-most-of-canvas-forked-fx4ppt</br>


# 相关文档

*  Vchart官方网站：https://visactor.bytedance.net/vchart/</br>
*  Vchart官方demo：https://visactor.bytedance.net/vchart/demo/area-chart/stacked-dash-area</br>