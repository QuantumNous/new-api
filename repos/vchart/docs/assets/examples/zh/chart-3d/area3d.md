---
category: examples
group: chart-3d
title: 3D面积图
keywords: space
order: 23-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/chart-3d/area3d.png
option: AreaChart
---

# 3D 面积图

在 2D 面积图的基础上配置 zField，即可被识别成 3D 面积图，然后配置 z 轴即可

## 关键配置

- `stack` 属性声明为 false 用来配置数据不采用堆叠，该属性在面积图中默认为 true，所以需要手动设置为 false

## 代码演示

```javascript livedemo
/**
 * 自1.12.0后，普通图表开启3d渲染的功能，需要手动加载3d插件，
 *
 * import { register3DPlugin } from '@visactor/vchart';
 *
 * register3DPlugin();
 *
 * 自2.0.0版本后，3d图表从vchart-extension中引入
 *
 * import { registerAxis3dPlugin } from '@visactor/vchart-extension';
 *
 * registerAxis3dPlugin();
 */

/** --Remove the following code when using in business-- */
if (VCHART_MODULE.register3DPlugin) {
  // 1.12.0 版本执行注册代码
  VCHART_MODULE.register3DPlugin();
} else if (VChartExtension.registerAxis3dPlugin) {
  // 2.0.0版本执行注册代码
  VChartExtension.registerAxis3dPlugin();
}
/** --Remove the above code when using in business-- */

const spec = {
  type: 'area',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: 'Unstacked area chart of cosmetic products sales'
  },
  stack: false,
  xField: 'type',
  yField: 'value',
  zField: 'country',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  axes: [
    {
      orient: 'bottom',
      mode: '3d'
    },
    {
      orient: 'left',
      mode: '3d'
    },
    {
      orient: 'z',
      mode: '3d',
      label: { visible: true },
      type: 'band',
      grid: { visible: true },
      width: 600,
      height: 200,
      depth: 200
    }
  ],
  crosshair: {
    xField: { visible: false }
  }
};

const vchart = new VChart(spec, {
  dom: CONTAINER_ID,
  disableDirtyBounds: true,
  options3d: {
    enable: true,
    enableView3dTransform: true,
    center: { x: 500, y: 250 }
  }
});
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[面积图](link)
