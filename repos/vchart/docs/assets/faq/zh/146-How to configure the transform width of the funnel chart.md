# 如何配置漏斗图的转化宽度？

## 问题描述

我在绘制漏斗图的时候发现当数据差异比较大的时候（比如最大的数据是 1000，最小的数据只有 10）最后绘制出来的漏斗图底下的图元会非常窄。请问有什么办法能配置漏斗图的转化宽度吗？

## 解决方案

VChart 漏斗图允许开发者通过 `minSize` 配置最小的漏斗宽度，以避免部分漏斗过窄的情况。

## 代码示例

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 1000,
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
          value: 10,
          name: 'Step5'
        }
      ]
    }
  ],
  minSize: 20,
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [Funnel minSize spec](https://visactor.io/vchart/option/funnelChart#minSize)
