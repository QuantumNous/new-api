# OMI 介绍

OMI 是一个基于 JSX 和 signal 的 Web 组件框架。相应的 OMIU 组件库提供了一系列开箱即用的 ui 组件，并为 VChart 提供了内置的封装。

- OMI 项目地址：[OMI](https://omi.cdn-go.cn/home/latest/introduction.html)
- OMIU 项目地址：[OMIU](https://omi.cdn-go.cn/omiu/latest/#/)

## 快速上手

一个简单的 OMIU 图表渲染代码如下所示：

```ts
<o-chart
  xField="month"
  yField="sales"
  data={{
    values: [
      { month: 'Monday', sales: 22 },
      { month: 'Tuesday', sales: 13 },
      { month: 'Wednesday', sales: 25 },
      { month: 'Thursday', sales: 29 },
      { month: 'Friday', sales: 38 }
    ]
  }}
></o-chart>
```

![omi-vchart](/vchart/guide/omi-vchart.png)

更多 OMIU 的 vchart 渲染示例请查看 [OMIU 图表示例](https://omi.cdn-go.cn/omiu/latest/#/data/chart/)
