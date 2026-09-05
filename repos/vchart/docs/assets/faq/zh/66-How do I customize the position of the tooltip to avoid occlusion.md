# 如何自定义 tooltip 的位置，避免遮挡？

## 问题描述

我在使用 VChart 图表时，图表的 tooltip 会被 dom 的边缘截断。我想了解 VChart 中如何自定义 tooltip 的位置来避免这种情况。

![tooltip](/vchart/faq/43-0.png)

## 解决方案

VChart 中控制 tooltip 的位置有很多方式，例如实现自定义 tooltip，或者指定 tooltip 的 offset 参数。
但你遇到的情况其实有简单的办法实现，通过指定 Tooltip 挂载的 dom 节点来实现。
默认情况下，tooltip 会挂载在页面的 body 上，因此是不应该出现截断的。你的情况可能是修改了`spec.tooltip.parentElement`的配置。删除或修改该配置应该就可以了。

## 代码示例

```javascript
spec.tooltip.parentElement = document.body;
```

## 结果展示

![demo](/vchart/faq/43-1.png)

Demo: [https://visactor.io/vchart/demo/line-chart/null-value-line](https://visactor.io/vchart/demo/line-chart/null-value-line)

## 相关文档

tooltip: [https://visactor.io/vchart/option/barChart#tooltip.parentElement](https://visactor.io/vchart/option/barChart#tooltip.parentElement)

github: [https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)

Tooltip tutorials: [https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip)
