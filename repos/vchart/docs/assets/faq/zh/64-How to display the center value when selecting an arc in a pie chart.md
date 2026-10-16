# 环形图中心指标能否设置选中时展示？

## 问题描述

在环形图中，中心区域有大量的空白，我想利用这些区域，在单击某个扇区时，在图表正中间显示该扇形对应的数值。

## 解决方案

VChart 的为饼图了设计了 indicator 组件，支持配置指标的标题与多行文本内容，提供对 fixed 和 hover 两种交互方式与常用的样式配置功能。

## 代码示例

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
  outerRadius: 0.6,
  innerRadius: 0.4,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10
    },
    state: {
      hover: {
        outerRadius: 0.65
      },
      selected: {
        outerRadius: 0.65
      }
    }
  },
  label: {
    visible: true
  },
  indicator: {
    visible: true,
    trigger: 'fixed',
    title: {
      visible: true,
      style: {
        fontSize: 18,
        text: data => {
          if (data) {
            const value = data['type'];
            return value ? value : null;
          }
          return null;
        }
      }
    },
    content: [
      {
        visible: true,
        style: {
          fontSize: 18,
          text: ''
        }
      },
      {
        visible: true,
        style: {
          fontSize: 18,
          text: data => {
            if (data) {
              const value = data['value'];
              return value ? `${value}%` : null;
            }
            return null;
          }
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

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [VChart 饼图指标示例](https://visactor.io/vchart/demo/pie-chart/pie-indicator)
- [VChart 饼图指标配置文档](https://visactor.io/vchart/option/pieChart#indicator.visible)
