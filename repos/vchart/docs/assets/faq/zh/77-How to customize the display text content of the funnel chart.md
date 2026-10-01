# 漏斗图如何自定义显示文字内容？

## 问题描述

我正在绘制一个漏斗图，我希望能够每一个漏斗里头的标签能够自定义展示内容，显示两行不同的文字，同时右侧的标签也需要能够自定义内容。我应该怎么来实现这样的效果呢？

类似下图中的效果：

![funnel](/vchart/faq/76-0.png)

## 解决方案

和其他的 VChart 图表一样，VChart 漏斗图同样支持自定义各个标签的样式以及内容，可以在相应的 label 配置项中配置回调函数来自定义文本标签的内容。如果文本内容的回调函数返回值为数组，那么最终展示的标签内容也将以多行进行展示。

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
    visible: true,
    style: {
      text: datum => {
        return [datum.name, datum.value];
      }
    }
  },
  transformLabel: {
    visible: true
  },
  outerLabel: {
    position: 'right',
    visible: true,
    style: {
      text: datum => {
        return datum.name;
      }
    }
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
- [funnelChart style spec](https://www.visactor.io/vchart/option/funnelChart#label.style.text)
