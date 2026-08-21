# 漏斗图百分比文字颜色如何修改？

## 问题描述

我看到有的图表库可以绘制这样的转化漏斗图，我希望能够在自定义这个漏斗图里头的百分比的文字，请问这个可以怎么来实现呢？

![funnel](/vchart/faq/81-0.png)

## 解决方案

VChart 漏斗图中的漏斗层标签、转换层标签以及外部标签均支持自定义的样式以及文本内容的设置。可以在对应的 label 配置项中设置 fill 视觉通道的值来指定需要的文本颜色。

## 代码示例

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  isTransform: true,
  isCone: false,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 5676,
          name: 'Sent'
        },
        {
          value: 3872,
          name: 'Viewed'
        },
        {
          value: 1668,
          name: 'Clicked'
        },
        {
          value: 610,
          name: 'Add to Cart'
        },
        {
          value: 565,
          name: 'Purchased'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Percentage of the customers have dropped from the sales process'
  },
  label: {
    visible: true
  },
  transformLabel: {
    visible: true,
    style: {
      fill: 'red'
    }
  },
  outerLabel: {
    position: 'right',
    visible: true
  },
  legends: {
    visible: true,
    orient: 'top'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [funnelChart transformLabel style spec](https://www.visactor.io/vchart/option/funnelChart#transformLabel.style.fill)
