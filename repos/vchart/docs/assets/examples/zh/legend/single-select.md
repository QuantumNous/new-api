---
category: demo
group: legend
title: 单选模式
keywords: lineChart,comparison,trend,line,legend
order: 27-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/legend/single-select.png
option: lineChart#legends
---

# 单选模式

离散图例支持单选模式，通过 `legend.selectMode` 配置。

## 关键配置

- `legend.selectMode` 配置单选模式
- `defaultSelected` 配置默认选中项

## 代码演示

```javascript livedemo
const data = [
  {
    name: 'Type A',
    value: 33934,
    year: 2010
  },
  {
    name: 'Type A',
    value: 52503,
    year: 2011
  },
  {
    name: 'Type A',
    value: 57177,
    year: 2012
  },
  {
    name: 'Type A',
    value: 69658,
    year: 2013
  },
  {
    name: 'Type A',
    value: 97031,
    year: 2014
  },
  {
    name: 'Type A',
    value: 119931,
    year: 2015
  },
  {
    name: 'Type A',
    value: 137133,
    year: 2016
  },
  {
    name: 'Type A',
    value: 154175,
    year: 2017
  },
  {
    name: 'Type B',
    value: 24916,
    year: 2010
  },
  {
    name: 'Type B',
    value: 24064,
    year: 2011
  },
  {
    name: 'Type B',
    value: 29742,
    year: 2012
  },
  {
    name: 'Type B',
    value: 29851,
    year: 2013
  },
  {
    name: 'Type B',
    value: 32490,
    year: 2014
  },
  {
    name: 'Type B',
    value: 30282,
    year: 2015
  },
  {
    name: 'Type B',
    value: 38121,
    year: 2016
  },
  {
    name: 'Type B',
    value: 40434,
    year: 2017
  },
  {
    name: 'Type C',
    value: 11744,
    year: 2010
  },
  {
    name: 'Type C',
    value: 17722,
    year: 2011
  },
  {
    name: 'Type C',
    value: 16005,
    year: 2012
  },
  {
    name: 'Type C',
    value: 19771,
    year: 2013
  },
  {
    name: 'Type C',
    value: 20185,
    year: 2014
  },
  {
    name: 'Type C',
    value: 24377,
    year: 2015
  },
  {
    name: 'Type C',
    value: 32147,
    year: 2016
  },
  {
    name: 'Type C',
    value: 39389,
    year: 2017
  },
  {
    name: 'Type D',
    value: null,
    year: 2010
  },
  {
    name: 'Type D',
    value: null,
    year: 2011
  },
  {
    name: 'Type D',
    value: 7988,
    year: 2012
  },
  {
    name: 'Type D',
    value: 12169,
    year: 2013
  },
  {
    name: 'Type D',
    value: 15112,
    year: 2014
  },
  {
    name: 'Type D',
    value: 22452,
    year: 2015
  },
  {
    name: 'Type D',
    value: 34400,
    year: 2016
  },
  {
    name: 'Type D',
    value: 34227,
    year: 2017
  },
  {
    name: 'Other',
    value: 12908,
    year: 2010
  },
  {
    name: 'Other',
    value: 5948,
    year: 2011
  },
  {
    name: 'Other',
    value: 8105,
    year: 2012
  },
  {
    name: 'Other',
    value: 11248,
    year: 2013
  },
  {
    name: 'Other',
    value: 8989,
    year: 2014
  },
  {
    name: 'Other',
    value: 11816,
    year: 2015
  },
  {
    name: 'Other',
    value: 18274,
    year: 2016
  },
  {
    name: 'Other',
    value: 18111,
    year: 2017
  }
];
const spec = {
  type: 'line',
  data: [
    {
      id: 'line',
      values: data
    }
  ],
  xField: 'year',
  yField: 'value',
  seriesField: 'name',
  legends: {
    orient: 'right',
    selectMode: 'single', // Configure legend selection mode
    defaultSelected: ['Type D'],
    title: {
      visible: true,
      text: 'Single Select'
    }
  },
  axes: [
    {
      orient: 'left',
      label: {
        inside: true,
        space: 2,
        style: {
          textBaseline: 'bottom',
          textAlign: 'start',
          fontWeight: 'bold'
        }
      },
      tick: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      title: {
        visible: true,
        text: 'Axis Title'
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
