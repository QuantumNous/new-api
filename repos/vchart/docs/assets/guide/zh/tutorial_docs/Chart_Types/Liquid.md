# 水波图

[\[配置项\]](../../../option/liquidChart)

## 简介

水波图通常是在圆形中填充动态水波来展示数据，通常用于展示实时进度。

### 图表构成

水波图由水波图元（`liquid`），水波背景图元（`liquidBackground`）和水波外轮廓图元(`liquidOutline`)构成。
![](/vchart/preview/liquid_tutorial_1.9.0.png)

水波图的数据字段及数据映射有如下配置：

- `liquidChart.type`: 图表类型，水波图图的类型为`'liquid'`
- `liquidChart.data`: 图表绘制的数据源
- `liquidChart.categoryField` 属性声明为值字段配置, 用于表示水波的高度

- 更多组件配置见[VChart liquidChart 配置](../../../option/liquidChart)

### 快速上手

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入registerLiquidChart并执行
// import { registerLiquidChart } from '@visactor/vchart';
// registerLiquidChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerLiquidChart();
/** --在业务中使用时请删除以上代码-- */
const spec = {
  type: 'liquid',
  valueField: 'value',
  maskShape: 'drop',
  outlineMargin: 10,
  outlinePadding: 10,
  indicatorSmartInvert: true,
  data: {
    id: 'data',
    values: [
      {
        value: 0.8
      }
    ]
  },
  indicator: {
    visible: true,
    title: {
      visible: true,
      style: {
        text: '进度'
      }
    },
    content: [
      {
        visible: true,
        style: {
          fill: 'black',
          text: '80%'
        }
      }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### 关键配置

- `valueField` 属性声明为值字段配置
- `maskShape` 属性声明为轮廓形状
- `outlineMargin` 属性声明为外轮廓与 region 边界之间的 padding
- `outlinePadding` 属性声明为内轮廓与外轮廓之间的 padding
- `indicatorSmartInvert` 属性声明为是否开启指标值智能反色

## 水波图

### 数据

- 一个`数值`字段，如: `value` ，映射水波图元高度。

一组进度数据定义如下：

```ts
data: [
  {
    values: [{ value: 0.5 }]
  }
];
```
