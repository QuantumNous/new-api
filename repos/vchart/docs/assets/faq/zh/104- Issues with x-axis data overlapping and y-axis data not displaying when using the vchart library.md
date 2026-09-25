---
title: 67. 使用vchart图表库时x轴数据重叠和y轴数据不显示的问题</br>
---
# 问题标题

使用vchart图表库时x轴数据重叠和y轴数据不显示的问题</br>


# 问题描述

我在使用vchart图表库制作柱状图的时候遇到问题。无论我在模拟器还是真机上测试，x轴（下轴）的数据会出现重叠的情况。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/U31SbU8VPojbmPxZQTrcRdc2n3r.gif' alt='' width='784' height='362'>

此外，我还注意到有一些柱状图的顶部标签会被挪到柱子内部，这是正常的吗？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KJgPbbvTsoz3VixX8j8chWMMnwb.gif' alt='' width='742' height='472'>

# 解决方案

有以下解决方案：</br>
对于x轴数据重叠的问题，这是因为关闭了sampling设置。原来是希望x轴的所有数据都能展示出来，结果导致了数据重叠的情况。可以使用滚动条来解决这个问题，为图表添加如下配置：</br>
`scrollBar: [ { orient: 'bottom', start: 0, end: 0.5, roam: true } ]`</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JrHObctlUoUZ4exawCwc1CeOn2b.gif' alt='' width='2410' height='1134'>

对于柱状图顶部标签被挪到柱子内部的问题，这是因为防止标签相互重叠，系统自动进行了调整。可以通过设置标签配置overlap为false来关闭该功能：</br>
`label: {overlap: false}`</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HTvTbHfV2o2VVwx0tBYcq8CQnge.gif' alt='' width='446' height='232'>

# 结果展示

在线demo：https://codesandbox.io/p/sandbox/line-chart-shows-on-the-left-most-of-canvas-forked-ytl8dz</br>
# 相关文档

*  VChart scrollbar教程文档：https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Scrollbar</br>
*  VChart label overlap文档：https://www.visactor.io/vchart/option/barChart#label.overlap</br>
*  VChart github：https://github.com/VisActor/VChart</br>

