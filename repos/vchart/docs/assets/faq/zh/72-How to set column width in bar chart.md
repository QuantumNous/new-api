# 柱状图如何设置柱子宽度？

## 问题描述

因为数据数量不确定，数据太少时柱状图柱子太宽不符合设计稿，怎么配置可以将柱子的宽度变窄？同时当数据很多的时候，柱子可以保持原本的宽度。

## 解决方案

VChart 的 柱图提供了可以设置柱子的宽度的配置项

1. bandWidth 直接设置柱子的宽度
2. barMinWidth 柱子的最小宽度
3. barMaxWidth 柱子的最大宽度

这个需求应该可以用 barMaxWidth 去解决，设置为设计稿中的最大宽度就可以了。

## 代码示例

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 }
      ]
    }
  ],
  barMinWidth: 20,
  xField: 'month',
  yField: 'sales',
  barMaxWidth: 50
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [柱状图配置](https://www.visactor.io/vchart/option/barChart#barWidth)
