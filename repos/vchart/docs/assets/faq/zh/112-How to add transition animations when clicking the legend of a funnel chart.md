# 漏斗图点击图例怎么添加过渡动画？

## 问题描述

我在开发漏斗图。发现点击图例的时候，没有任何动画效果，切换有点生硬，有什么图表库支持图例点击的动画效果配置？  
![funnel animation](/vchart/faq/16-0.gif)

## 解决方案

推荐你使用 VChart。VChart 的漏斗图在图例筛选时，是有默认过渡动画的，参考官网 [demo](https://visactor.io/vchart/demo/funnel-chart/basic-funnel)。

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

- [漏斗图示例](https://visactor.io/vchart/demo/funnel-chart/basic-funnel)
- [github](https://github.com/VisActor/VChart)
