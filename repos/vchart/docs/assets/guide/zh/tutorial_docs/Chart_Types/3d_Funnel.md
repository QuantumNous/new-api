3d 漏斗图

## 简介

3D 漏斗图的配置大部分继承了普通词云的配置，区别在于 type 需要配置成 funnel3d，然后 VChart 实例化时添加 option3d 配置

## 图表构成

漏斗图由具有层级关系的多边形图元（该多边形默认是梯形，也可以是矩形，视用户配置而定）、转化层、标签等基本元素及其他组件构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/4d877ccaf041cff1618de3405.png)

多边形图元为漏斗图的基本要素，相关的绘制配置必不可少:

- `funnelChart.type`: 图表类型，漏斗图的类型为`'funnel3d'`
- `funnelChart.data`: 图表绘制的数据源
- `funnelChart.categoryField`: 分类字段，映射为不同图元
- `funnelChart.valueField`: 数值字段，映射为矩形图元的大小或梯形图元的顶边及底边的长度

转化层、标签等辅助元素，仅在特定配置下展示且在不同配置下展示形式略有不同：

- `funnelChart.label`: 漏斗图标签配置，'`visible: true'`时展示。
- `funnelChart.isTransform`: 是否展示转化层，该配置为'`true'`时展示。

提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `funnelChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/funnelChart#tooltip)
- 更多组件配置见[VChart funnelChart 配置](../../../option/funnelChart)

作为 3d 图表，3d 散点图需要开启 3d 视图，需要在 vchart 的初始化参数中配置 3d 视角:

- `options3d.enable`: 启用 3d 视角

## 快速上手

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

其他配置参考[漏斗图]()
