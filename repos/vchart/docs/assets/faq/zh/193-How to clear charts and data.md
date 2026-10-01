# 如何清空图表和数据？

## 问题描述

请问下有 api 能清空一个已经 render 的图表吗？期望清空图表中的图形，但是保留轴等组件。

## 解决方案

在 VChart 中，如果你想要清空整个图表可以直接调用图表实例的 `release` 方法。如果想要只清空图表的图形，但是保留轴等组件，可以使用 `updateData` 方法将数据设置为空，如下：

```ts
// 假设你的数据 id 为 'data'
vchart.updateData('data', []);
```

## 结果展示

在线效果参考：[https://codesandbox.io/s/clear-mark-4s75yy](https://codesandbox.io/s/clear-mark-4s75yy)

## 相关文档

- [图表 API](https://www.visactor.io/vchart/api/API/vchart)

* [github](https://github.com/VisActor/VChart)
