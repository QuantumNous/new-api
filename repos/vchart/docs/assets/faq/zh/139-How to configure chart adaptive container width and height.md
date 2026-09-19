# 如何配置图表自适应容器宽高？

## 问题描述

我在使用 VChart 图表时，希望图表能够自动适应外部容器的大小，应该如何操作？

## 解决方案

VChart 的图表提供 autoFit 属性，在默认情况下就是自适应容器大小的。该配置的优先级高于构造函数中的 autoFit 配置。如果用户配置了 width，则以用户配置的 width 为准，height 同理。
你这边没有提供更多的背景信息，我猜测一下图表没有自适应的原因：

1. 如果你在 spec 里指定的大小，此时将不会再自适应容器大小
2. spec 中的 autoFit 开关被关闭了
3. 外部通过 css 限制了 Dom 的尺寸

一般来说前两种情况是常见的，你可以输出一下你的最终 spec 排查一下你得情况。

## 代码示例

```javascript
const spec = {
  type: 'common',
  autoFit:true,
  (...)
  }
```

## 相关文档

tooltip option: [https://visactor.io/vchart/option/barChart#autoFit](https://visactor.io/vchart/option/barChart#autoFit)

github: [https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)
