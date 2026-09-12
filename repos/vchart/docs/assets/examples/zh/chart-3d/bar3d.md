---
category: examples
group: chart-3d
title: 3D 基础柱状图
keywords: space
order: 23-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/chart-3d/bar3d.png
option: bar3dChart
---

# 基础柱状图

3D 柱形图的配置大部分继承了普通柱形图的配置，区别在于 type 需要配置成 rect3d，然后 ChartSpace 实例化时添加 option3d 配置。
3D 柱形图具备笛卡尔轴，轴也可以配置 mode: 3d 支持 3D 模式

## 关键配置

- `type: bar3d` 属性声明为柱形图
- `xField` 属性声明为分类字段或时序字段
- `yField` 属性声明为数值字段
- `length` rect 的 3d 长度属性，控制 z 方向的长度
- `z` rect 在 3d 模式下的 z 坐标位置
- `mode: 3d` 轴支持 mode 控制不同的模式

## 代码演示

```javascript livedemo
/**
 * 自2.0.0版本后，3d图表从vchart-extension中引入
 *
 * import { registerBar3dChart } from '@visactor/vchart-extension';
 *
 * registerBar3dChart();
 */

/** --Remove the following code when using in business-- */
if (VChartExtension.registerBar3dChart) {
  VChartExtension.registerBar3dChart();
}
/** --Remove the above code when using in business-- */

const spec = {
  type: 'bar3d',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  bar3d: {
    style: {
      length: 20,
      z: -20
    },
    state: {
      selected: {
        stroke: '#000',
        strokeWidth: 1
      }
    }
  },
  axes: [
    { orient: 'bottom', type: 'band', tick: { tickSize: 20 }, mode: '3d' },
    { orient: 'left', type: 'linear', tick: { tickSize: 20 }, mode: '3d' }
  ]
};

const vchart = new VChart(spec, {
  dom: CONTAINER_ID,
  disableDirtyBounds: true,
  options3d: {
    enable: true
  }
});
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[3D 柱状图](link)
