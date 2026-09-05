---
category: examples
group: chart-3d
title: 3D 基础饼图
keywords: space
order: 23-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/chart-3d/pie3d.png
option: pieChart
---

# 基础 3d 饼图

3D 饼图的配置大部分继承了普通词云的配置，区别在于 type 需要配置成 pie3d，然后 ChartSpace 实例化时添加 option3d 配置

## 何时使用

1. 展示不同分类数据占比。
2. 比较不同分类的大小，且各分类值差异较为明显。

## 关键配置

- `options3d` 此配置为 ChartSpace 构造函数中传入的配置，声明该 ChartSpace 需要支持 3d 模式
- `categoryField`、`valueField` 属性分别用于指定饼图类别与扇形角度字段
- `innerRadius`、`outerRadius` 属性用于指定扇区的内外半径

## 代码演示

```javascript livedemo
/**
 * 自2.0.0版本后，3d图表从vchart-extension中引入
 *
 * import { registerPie3dChart } from '@visactor/vchart-extension';
 *
 * registerPie3dChart();
 */

/** --Remove the following code when using in business-- */
if (VChartExtension.registerPie3dChart) {
  VChartExtension.registerPie3dChart();
}
/** --Remove the above code when using in business-- */

const spec = {
  type: 'pie3d',
  data: [
    {
      id: 'id0',
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
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: false,
    position: 'inside',
    support3d: true,
    style: {
      stroke: '#fff',
      keepDirIn3d: false,
      fontSize: 12
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
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

[3D 饼图](link)
