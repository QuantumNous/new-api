# 如何在小程序中使用图表库？

## 问题描述

我想要在小程序上绘制图表，有哪些开箱即用的图表库推荐吗？

## 解决方案

不同的图表库有不同的解决方案，下面介绍下 [VChart](https://www.visactor.io/vchart/) 图表库的支持情况，目前 VChart 支持了飞书小程序、飞书小组件以及 taro 跨端框架的图表渲染，使用时非常简单，只需要在初始化图表示例的时候声明对应的跨端环境参数即可，图表配置项使用及功能上同 PC 表现一致。

## 代码示例

我们提供了飞书小组件以及飞书小程序的 demo 实例：

- 飞书小程序：https://github.com/VisActor/lark-vchart-example
- 飞书小组件：https://github.com/VisActor/VChart/tree/develop/packages/block-vchart

## 结果展示

下面是在 飞书小程序上的图表渲染实例：

![](/vchart/faq/83-0.gif)

## 相关文档

- [跨端兼容说明](https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/mini-app/how)
- [飞书小程序使用教程](https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/mini-app/block)
- [飞书小组件使用教程](https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/mini-app/block)
