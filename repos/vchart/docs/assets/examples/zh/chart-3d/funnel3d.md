---
category: examples
group: chart-3d
title: 3D 基础漏斗图
keywords: space
order: 23-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/chart-3d/funnel3d.png
option: funnel3dChart
---

# 基础漏斗图

3D 漏斗图的配置大部分继承了普通词云的配置，区别在于 type 需要配置成 funnel3d，然后 ChartSpace 实例化时添加 option3d 配置

## 何时使用

1. 数据是有序的，彼此之间有逻辑上的顺序关系，阶段最好大于 3 个。
2. 该流程应是“消耗性”的流程，如在电商领域，注册用户一定是经过层层消耗，才到达下单环节；在人力领域，收到的简历一定经过多轮筛选，才进入终面。

## 关键配置

- `type: funnel3d` 指定图表类型为漏斗图
- `categoryField` 指定分类字段
- `valueField` 指定值字段
- `support3d` 标签配置 support 表示支持 3d 模式
- `face` 目前 3d 漏斗图依然不成熟，需要用户根据角度配置出合适效果

## 代码演示

```javascript livedemo
/**
 * 自2.0.0版本后，3d图表从vchart-extension中引入
 *
 * import { registerFunnel3dChart } from '@visactor/vchart-extension';
 *
 * registerFunnel3dChart();
 */

/** --Remove the following code when using in business-- */
if (VChartExtension.registerFunnel3dChart) {
  VChartExtension.registerFunnel3dChart();
}
/** --Remove the above code when using in business-- */

const spec = {
  padding: {
    top: 30
  },
  type: 'funnel3d',
  categoryField: 'name',
  valueField: 'value',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true,
    support3d: true
  },
  maxSize: 400,
  minSize: 50,
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, {
  dom: CONTAINER_ID,
  disableDirtyBounds: true,
  options3d: {
    enable: true,
    center: {
      dx: 100,
      dy: 100
    }
  }
});
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## 相关教程

[3D 漏斗图](link)
