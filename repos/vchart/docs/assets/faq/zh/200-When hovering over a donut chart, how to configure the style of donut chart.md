# 环形图 hover 的时候，如何配置边框的样式？

## 问题描述

环形图的交互中，当指针悬停在环形图的扇区上时，如何改变扇区的边框颜色、边框粗细、调整扇区的半径大小以及改变扇区的填充透明度？
除此之外，如何处理其他扇区，即非悬停状态下的扇区的样式？

## 解决方案

VChart 图表已经提供了对应的功能，VChart 对图元上的各种常用交互抽象为了图元的状态，将图元的状态分为了以下几种：

- `hover` 指针悬浮状态，图元被鼠标指针悬浮时的状态。
- `hover_reverse` 非指针悬浮状态，当有图元进入了 `hover` 状态时，其他图元的状态。
- `selected` 选中状态，图元被选中时的状态。
- `selected_reverse` 非选中状态，当有图元进入了 `selected` 状态时，其他图元的状态。
- `dimension_hover` 维度悬浮状态，鼠标指针悬浮在某一段 x 轴区域内时的状态。
- `dimension_hover_reverse` 非维度悬浮状态，当有图元进入了 `dimension_hover` 状态时，其他图元的状态。

如果想要 hover 到环形图时，改变图元的样式，可以在 pie 配置中，设置图元的 hover 状态。
[参考文档：图元的状态](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Series/Mark)

## 代码示例

在以下示例中，`pie.state` 中设置了 4 个状态

1. `hover`: 指针悬浮到的图元， 显示描边，填充透明度变低，扩展外半径。
2. `hover_reverse`：其它未悬浮到的图元，缩小外半径。
3. `selected`：指针选中的图元，扩大内半径和外半径。
4. `selected_reverse`：其它未选中的图元，填充透明度变低。

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'data',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.5,
  pie: {
    state: {
      hover: {
        stroke: '#0FF',
        lineWidth: 1,

        fillOpacity: 0.9,
        outerRadius: 0.85
      },
      hover_reverse: {
        outerRadius: 0.7,
        innerRadius: 0.5
      },
      selected: {
        outerRadius: 0.85,
        innerRadius: 0.6
      },
      selected_reverse: {
        fillOpacity: 0.25
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [图元状态教程](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Series/Mark)
- [图表示例](https://visactor.io/vchart/demo/pie-chart/ring?keyword=pieChart)
