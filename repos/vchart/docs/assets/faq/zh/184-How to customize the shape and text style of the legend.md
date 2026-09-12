# 如何自定义图例的形状和文字样式？

## 问题描述

请问如何自定义图例项的形状，同时修改文字的样式，实现类似下图的图例样式：

![](/vchart/faq/88-0.png)

## 解决方案

不同的图表库解决方案不同，下面介绍下使用 VChart 如何进行配置，目前 VChart 要实现上图的显示效果，需要：

1.  自定义数据，主要是为了给图例项数据添加数值字段，这样可以在图例项上显示数值，也可以通过 `item.value` 属性配置数值的样式
1.  在 VChart 中，饼图的图例形状默认是圆形，但是如果想要配置成其他形状，也是可以直接通过 `item.shape.style.symbolType` 来配置的

![](/vchart/faq/88-1.png)

## 代码示例

```javascript livedemo
const pieData = [
  {
    value: '159',
    type: 'Tradition Industries'
  },
  {
    value: '50',
    type: 'Business Companies'
  },
  {
    value: '13',
    type: 'Customer-facing Companies'
  }
];

const spec = {
  type: 'pie',
  data: [
    {
      values: pieData
    }
  ],
  categoryField: 'type',
  valueField: 'value',
  legends: {
    visible: true,
    orient: 'right',
    data: legendData => {
      const map = {};
      pieData.forEach(obj => {
        map[obj.type] = obj.value;
      });

      return legendData.map(datum => {
        datum.value = map[datum.label];
        return datum;
      });
    },
    item: {
      shape: {
        style: {
          symbolType: 'square'
        }
      },
      label: {
        style: {
          fill: '#999'
        }
      },
      value: {
        style: {
          fill: '#000',
          fontWeight: 'bold'
        },
        space: 10
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档 Related Documentation

- 图例教程：[https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)
- 图例配置：[https://www.visactor.io/vchart/option/lineChart#legends-discrete.type](https://www.visactor.io/vchart/option/lineChart#legends-discrete.type)
