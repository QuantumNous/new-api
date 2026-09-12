# 如何自定义图例的文本内容？

## 问题描述

如下如所示，怎么把图中的 “x” 换成商品点击量？

![](/vchart/faq/91-0.png)

## 解决方案

这个对应的是图表中的图例部分，不同的图表库解决方案不同，下面介绍下 VChart 上的配置，在 VChart 上图例对应 `legends` 属性，“x” 对应的是图例项上的 label 文本，对应的属性为 `legends.item.label`，然后我们可以通过该属性提供的 `formatMethod` 属性对显示文本进行格式化。

![](/vchart/faq/91-1.png)

## 代码示例

```javascript livedemo
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      fields: { y: { alias: '商品点击量' }, x: { alias: 'shijian' } },
      values: [
        { x: '2:00', y: 8 },
        { x: '4:00', y: 9 },
        { x: '6:00', y: 11 },
        { x: '8:00', y: 14 },
        { x: '10:00', y: 16 },
        { x: '12:00', y: 17 },
        { x: '14:00', y: 17 },
        { x: '16:00', y: 16 },
        { x: '18:00', y: 15 }
      ]
    }
  ],
  legends: {
    visible: true,
    orient: 'bottom',
    item: {
      label: {
        formatMethod: text => '商品点击量'
      }
    }
  },

  xField: 'x',
  yField: 'y'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [图例教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)
- [图例配置](https://www.visactor.io/vchart/option/lineChart#legends-discrete.type)
