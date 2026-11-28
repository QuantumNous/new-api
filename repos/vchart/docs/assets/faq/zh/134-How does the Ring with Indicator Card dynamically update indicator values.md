# 带指标卡环形图如何动态更新指标值?

## 问题描述

类似 （https://www.visactor.io/vchart/demo/pie-chart/pie-indicator）这样的带指标卡环形图，
这个指标卡里的数值现在是用户自己定义的，不支持自动变，但是可以计算之后更新这个值。指标卡里这个数字可以根据 hover 的扇区改变吗？该如何实现？

## 解决方案

不同图表库的解决方案不一样，根据你给的 demo，只需要设置交互触发类型和配置 text 字段内容。

- indicator.trigger 用来设置交互触发类型。可选的交互类型有 hover、select、none。默认设置交互触发类型为 select。根据你的需求，需要将 indicator.trigger 设置为 hover。
- indicator.title.style.text 用来设置文本内容，且支持回调。可以根据需要的数据字段，在 text 中配置所需字段并可根据需求格式化展现形式。

## 代码示例

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10,
      texture: datum => datum['texture']
    },
    state: {
      hover: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  indicator: {
    visible: true,
    trigger: 'hover',
    limitRatio: 0.4,
    title: {
      visible: true,
      autoFit: true,
      style: {
        fontWeight: 'bolder',
        fontFamily: 'Times New Roman',
        fill: '#888',
        text: datum => {
          const d = datum ?? data[0];
          return d['formula'];
        }
      }
    },
    content: [
      {
        visible: true,
        style: {
          fontSize: 20,
          fill: 'orange',
          fontWeight: 'bolder',
          fontFamily: 'Times New Roman',
          text: datum => {
            const d = datum ?? data[0];
            return d['type'];
          }
        }
      },
      {
        visible: true,
        style: {
          fontSize: 18,
          fill: 'orange',
          fontFamily: 'Times New Roman',
          text: datum => {
            const d = datum ?? data[0];
            return d['value'] + '%';
          }
        }
      }
    ]
  },
  legends: {
    visible: true,
    orient: 'left',
    item: {
      shape: {
        style: {
          symbolType: 'circle',
          texture: datum => datum['texture']
        }
      }
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

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 结果展示

- [在线效果参考](https://codesandbox.io/s/pie-chart-with-indicator-card-4ypr2k)

## 相关文档

- [带指标卡饼图 demo](https://www.visactor.io/vchart/demo/pie-chart/pie-indicator)
- [指标卡教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Indicator)
- [相关 api](https://www.visactor.io/vchart/option/pieChart#indicator)
- [github](https://github.com/VisActor/VChart)
