---
category: examples
group: layout
title: 行内元素对齐配置
order: 37-3
cover: /vchart/preview/layout-align-self_1.9.0.png
option: pieChart#layout
---

# 行内元素对齐配置

在图表中，行内布局的元素，可以通过`alignSelf`调整行内对齐方式。

## 关键配置

- layoutType: 'normal-inline'，行内布局类型。
- alignSelf: 'end'，调整行内对齐方式。

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'id0',
      values: [
        { type: '0~29', value: '126.04' },
        { type: '30~59', value: '128.77' },
        { type: '60~', value: '77.09' }
      ]
    },
    {
      id: 'id1',
      values: [
        { type: '0~9', value: '39.12' },
        { type: '10~19', value: '43.01' },
        { type: '20~29', value: '43.91' },
        { type: '30~39', value: '45.4' },
        { type: '40~49', value: '40.89' },
        { type: '50~59', value: '42.48' },
        { type: '60~69', value: '39.63' },
        { type: '70~79', value: '25.17' },
        { type: '80 and over', value: '12.29' }
      ]
    }
  ],
  series: [
    {
      type: 'pie',
      dataIndex: 0,
      outerRadius: 0.65,
      innerRadius: 0,
      valueField: 'value',
      categoryField: 'type',
      label: {
        position: 'inside',
        visible: true,
        style: {
          fill: 'white'
        }
      },
      pie: {
        style: {
          stroke: '#ffffff',
          lineWidth: 2
        }
      }
    },
    {
      type: 'pie',
      dataIndex: 1,
      outerRadius: 0.8,
      innerRadius: 0.67,
      valueField: 'value',
      categoryField: 'type',
      label: {
        visible: true
      },
      pie: {
        style: {
          stroke: '#ffffff',
          lineWidth: 2
        }
      }
    }
  ],
  color: ['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00'],
  title: {
    visible: true,
    text: 'Population Distribution by Age in the United States, 2021 (in millions)',
    textStyle: {
      fontFamily: 'Times New Roman'
    }
  },
  legends: [
    {
      visible: true,
      title: {
        visible: true,
        text: 'Inner'
      },
      orient: 'bottom',
      layoutType: 'normal-inline',
      position: 'start',
      // alignSelf: 'end',
      maxHeight: 100,
      data: (data, colorScale, globalScale) => {
        return data.slice(0, 3);
      }
    },
    {
      visible: true,
      orient: 'bottom',
      layoutType: 'normal-inline',
      position: 'start',
      // alignSelf: 'end',
      // title: {
      //   visible: true,
      //   text: 'Outter'
      // },
      maxHeight: 100,
      data: (data, colorScale, globalScale) => {
        return data.slice(3);
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
