# 布局案例：grid 布局

## 案例介绍

这是一个经典的多图表场景，多个线图从上到下排成一列，它们共用一个下方的下轴，每个都有自己的左轴，然后共用一个图例。

## 案例配置

```javascript livedemo
const leftAxesCommonSpec = {
  expand: { max: 0.2 },
  label: { flush: true, visible: true },
  tick: { visible: false },
  forceTickCount: 3
};
const spec = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 2,
    row: 4,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        colSpan: 2,
        row: 3
      },
      {
        modelId: 'temperature',
        col: 1,
        row: 0
      },
      {
        modelId: 'humidity',
        col: 1,
        row: 1
      },
      {
        modelId: 'temperature-left',
        col: 0,
        row: 0
      },
      {
        modelId: 'humidity-left',
        col: 0,
        row: 1
      },
      {
        modelId: 'axes-bottom',
        col: 1,
        row: 2
      }
    ]
  },
  region: [
    {
      id: 'temperature'
    },
    {
      id: 'humidity'
    }
  ],
  legends: {
    padding: {
      top: 10
    },
    visible: true,
    orient: 'bottom',
    id: 'legend',
    regionId: ['temperature', 'humidity']
  },
  series: [
    {
      id: 'temperature-series',
      regionId: 'temperature',
      type: 'line',
      seriesField: 'type',
      data: { id: 'temperatureData' },
      xField: 'date',
      yField: 'value'
    },
    {
      id: 'humidity-series',
      regionId: 'humidity',
      type: 'line',
      seriesField: 'type',
      data: { id: 'humidityData' },
      xField: 'date',
      yField: 'value'
    }
  ],
  axes: [
    {
      id: 'temperature-left',
      regionId: 'temperature',
      orient: 'left',
      title: { visible: true, text: 'SP' },
      ...leftAxesCommonSpec
    },
    {
      id: 'humidity-left',
      regionId: 'humidity',
      orient: 'left',
      title: { visible: true, text: 'ES' },
      ...leftAxesCommonSpec
    },
    {
      id: 'axes-bottom',
      regionId: ['temperature', 'humidity'],
      orient: 'bottom',
      label: {
        firstVisible: true,
        lastVisible: true,
        visible: true
      },
      tick: { visible: false },
      paddingInner: 0.99,
      paddingOuter: 0
    }
  ],
  data: [
    {
      id: 'temperatureData',
      values: [
        { date: '周一', value: 36, type: 'maximum-temperature' },
        { date: '周二', value: 37, type: 'maximum-temperature' },
        { date: '周三', value: 38, type: 'maximum-temperature' },
        { date: '周四', value: 38, type: 'maximum-temperature' },
        { date: '周五', value: 40, type: 'maximum-temperature' },

        { date: '周一', value: 21, type: 'minimum-temperature' },
        { date: '周二', value: 21, type: 'minimum-temperature' },
        { date: '周三', value: 22, type: 'minimum-temperature' },
        { date: '周四', value: 23, type: 'minimum-temperature' },
        { date: '周五', value: 24, type: 'minimum-temperature' }
      ]
    },
    {
      id: 'humidityData',
      values: [
        { date: '周一', value: 36, type: 'maximum-humidity' },
        { date: '周二', value: 37, type: 'maximum-humidity' },
        { date: '周三', value: 38, type: 'maximum-humidity' },
        { date: '周四', value: 38, type: 'maximum-humidity' },
        { date: '周五', value: 40, type: 'maximum-humidity' },

        { date: '周一', value: 21, type: 'minimum-humidity' },
        { date: '周二', value: 21, type: 'minimum-humidity' },
        { date: '周三', value: 22, type: 'minimum-humidity' },
        { date: '周四', value: 23, type: 'minimum-humidity' },
        { date: '周五', value: 24, type: 'minimum-humidity' }
      ]
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
