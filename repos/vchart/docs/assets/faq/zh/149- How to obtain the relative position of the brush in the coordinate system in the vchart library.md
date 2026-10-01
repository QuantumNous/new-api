---
title: 66. 如何在vchart图表库中获取brush在坐标系中的相对位置？</br>
---
# 问题标题

如何在vchart图表库中获取brush在坐标系中的相对位置？</br>


# 问题描述

我在使用vchart图表库时，遇到了一点问题，我监听了onBrushEnd事件，想要获取brush所框选区域在坐标系中的相对位置。即，当我在图表上画框以后，我想获取这个区域在x/y轴上的位置范围。我尝试了所有我能想到的方法，但是却没有找到对应的数据。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WBSxbjQLJoLxldxODj5cfyUBnOg.gif' alt='' width='862' height='832'>

# 解决方案

根据vchart的设计和使用，目前vchart的API并没有直接提供这个信息，但是还是可以通过一些其它的方式获取到这个必要的信息。具体如下步骤：</br>
1. 通过`vchart.getAllComponents()`找到brush组件</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/UsMmbspO3oEbAkxo4TLcKQQXnyd.gif' alt='' width='688' height='1158'>

1. 在brush组件里，有一个叫`_brushComponent.AABBBounds`的属性，这个就是选框在region中的相对位置。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BIjnbBaYyooFuZxveL6cYUMPnFg.gif' alt='' width='624' height='606'>

3. 同样，通过`vchart.getAllComponents()`方法，我们可以找到x和y轴的组件。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ADyXbsV3konqXoxYliAcuScOnRe.gif' alt='' width='716' height='1082'>

4. 在找到的轴组件中，我们可以使用`_scale.invert(position)`方法，把上一步中获取到的AABBBounds的位置，转换到x和y轴的具体数值。</br>


为了防止用户单击的时候出现极小的位置偏移，误触发brush绘制，我们还可以为brush设置一个`sizeThreshold`属性。这个属性的意思是选框大小阈值，直译就是你需要画的框的最小大小。只有框的大小大于这个阈值时，才会触发brush的事件。</br>




# 相关文档

*  VChart `sizeThreshold`配置项：https://www.visactor.io/vchart/option/barChart#brush.sizeThreshold</br>
*  VChart github：https://github.com/VisActor/VChart</br>

