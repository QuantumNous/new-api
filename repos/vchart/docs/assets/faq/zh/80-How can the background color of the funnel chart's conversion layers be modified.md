# 漏斗图转化层的背景颜色如何修改？

## 问题描述

在漏斗图中转化层用于描述不同阶段或步骤之间的转化过程。
漏斗图的转化层的背景颜色通常默认为单一颜色，如何修改漏斗图转化层的背景颜色，以提高可视化的效果和可读性？

## 解决方案

VChart 的漏斗图已经提供了对应的功能，允许用户在 `transform` 配置中设置转化层的图元样式。
若要改变漏斗图转化层的背景颜色，可以通过配置 `transform.style.fill` 修改转化层的背景色。

## 代码示例

```javascript livedemo
const spec = {
  type: 'funnel',
  maxSize: '75%',
  minSize: '10%',
  isTransform: true,
  shape: 'rect',
  transform: {
    style: {
      fill: '#44b15920',
      lineWidth: 4,
      stroke: 'white'
    }
  },
  label: {
    visible: true
  },
  outerLabel: {
    visible: true,
    position: 'right',
    style: {
      text: datum => {
        return `${datum.percent * 100}%`;
      }
    }
  },
  transformLabel: {
    visible: true,
    style: {
      fill: '#000000'
    }
  },
  data: [
    {
      name: 'funnel',
      values: [
        {
          value: 100,
          name: 'Resume Screening',
          percent: 1
        },
        {
          value: 80,
          name: 'Resume Evaluation',
          percent: 0.8
        },
        {
          value: 50,
          name: 'Evaluation Passed',
          percent: 0.5
        },
        {
          value: 30,
          name: 'Interview',
          percent: 0.3
        },
        {
          value: 10,
          name: 'Final Pass',
          percent: 0.1
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [漏斗图转化层 示例](https://visactor.io/vchart/demo/funnel-chart/rect-funnel?keyword=funnelChart)
- [漏斗图配置项 文档](https://visactor.io/vchart/option/funnelChart#transform)
