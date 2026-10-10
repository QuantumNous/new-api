# 如何实现百分比条形和 tgi 图的组合？

## 问题描述

我想使用前端图表库实现百分比条形图和 tgi 图的组合。tgi 图使用垂直方向的柱子来表示 tgi 数值，并用折线将不同的柱子链接。两个图表使用不同的坐标轴，请问该如何实现呢？

## 解决方案

你可以使用@VisActor/VChart 实现想要的效果。VChart 允许多个 series 组合在一张图表中，仅需要将图表类型设为 common，并在 series 中添加柱状图和折线图的 series，修改折线图的线样式为虚线，点样式为矩形，即可实现图中效果。为了实现柱图与线图使用不同的坐标轴，在 axes 中，需要配置 3 个坐标轴：左侧的 band 轴，底部线图的 linear 轴，除此之外还需要给柱图配置一个 linear 轴。你可以将该轴放置在顶部并将 visible 设为 false，并通过调整 max 属性，指定轴的范围。

## 代码示例

图表 spec 如下：

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'data',
      values: [
        { x: '2015-09-24', y: 0.6 },
        { x: '2015-09-25', y: 0.7 },
        { x: '2015-09-26', y: 0.71 },
        { x: '2015-09-27', y: 0.65 },
        { x: '2015-09-28', y: 0.53 },
        { x: '2015-09-29', y: 0.55 }
      ]
    },
    {
      id: 'data2',
      values: [
        { x: '2015-09-24', y: 40 },
        { x: '2015-09-25', y: 25 },
        { x: '2015-09-26', y: 31 },
        { x: '2015-09-27', y: 37 },
        { x: '2015-09-28', y: 28 },
        { x: '2015-09-29', y: 22 }
      ]
    }
  ],

  series: [
    {
      type: 'bar',
      id: 'barSeries',
      direction: 'horizontal',
      dataId: 'data',
      yField: 'x',
      xField: 'y'
    },
    {
      type: 'line',
      id: 'lineSeries',
      direction: 'horizontal',
      dataId: 'data2',
      yField: 'x',
      xField: 'y',
      line: {
        style: {
          lineDash: [2, 5]
        }
      },

      point: {
        style: {
          symbolType: 'rect',
          size: 10,
          scaleX: 1,
          scaleY: 10
        }
      }
    }
  ],
  axes: [
    {
      orient: 'left',
      seriesId: ['barSeries', 'lineSeries'],
      type: 'band',
      grid: {
        visible: true
      }
    },
    {
      orient: 'top',
      type: 'linear',
      max: 1.2,
      seriesId: ['barSeries'],
      grid: {
        visible: true
      },
      visible: false
    },
    {
      orient: 'bottom',
      type: 'linear',
      seriesId: ['lineSeries'],

      grid: {
        visible: true
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 结果展示

- [在线效果参考](https://codesandbox.io/s/bar-chart-and-tgi-chart-8fkprk?file=/src/index.ts)

## 相关文档

- [VChart 组合图教程](https://visactor.io/vchart/guide/tutorial_docs/Chart_Types/Combination)
- [组合图配置项](https://visactor.io/vchart/option/commonChart#type)
- [github](https://github.com/VisActor/VChart)
