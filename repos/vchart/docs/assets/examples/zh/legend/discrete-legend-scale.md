---
category: demo
group: legend
title: 离散图例指定scale
keywords: radarChart,legend,circle,comparison,composition
order: 27-9
cover: /vchart/preview/legend-discrete-legend-scale_1.10.4.png
option: radarChart#legends
---

# 离散图例指定 scale

通过关联`scale`的方式，解析图例数据

## 关键配置

- `legends` 配置图例
- `scaleName` 配置图例映射的 scale
- `field` 配置图例对应的字段

## 代码演示

```javascript livedemo
const spec = {
  type: 'radar',
  categoryField: 'date',
  valueField: 'value',
  seriesField: 'group',

  data: {
    id: 'data0',
    values: [
      {
        cat0: '小型企业',
        date: '2016',
        cat1: '家具',
        group: '小型企业  家具',
        value: '402'
      },
      {
        cat0: '小型企业',
        date: '2016',
        cat1: '技术',
        group: '小型企业  技术',
        value: '279'
      },
      {
        cat0: '小型企业',
        date: '2016',
        cat1: '办公用品',
        group: '小型企业  办公用品',
        value: '827'
      },
      {
        cat0: '公司',
        date: '2016',
        cat1: '技术',
        group: '公司  技术',
        value: '564'
      },
      {
        cat0: '公司',
        date: '2016',
        cat1: '家具',
        group: '公司  家具',
        value: '566'
      },
      {
        cat0: '公司',
        date: '2016',
        cat1: '办公用品',
        group: '公司  办公用品',
        value: '1472'
      },
      {
        cat0: '公司',
        date: '2017',
        cat1: '家具',
        group: '公司  家具',
        value: '618'
      },
      {
        cat0: '小型企业',
        date: '2017',
        cat1: '家具',
        group: '小型企业  家具',
        value: '392'
      },
      {
        cat0: '公司',
        date: '2017',
        cat1: '技术',
        group: '公司  技术',
        value: '638'
      },
      {
        cat0: '公司',
        date: '2017',
        cat1: '办公用品',
        group: '公司  办公用品',
        value: '1632'
      },
      {
        cat0: '小型企业',
        date: '2017',
        cat1: '技术',
        group: '小型企业  技术',
        value: '412'
      },
      {
        cat0: '小型企业',
        date: '2017',
        cat1: '办公用品',
        group: '小型企业  办公用品',
        value: '1036'
      },
      {
        cat0: '小型企业',
        date: '2018',
        cat1: '家具',
        group: '小型企业  家具',
        value: '499'
      },
      {
        cat0: '公司',
        date: '2018',
        cat1: '家具',
        group: '公司  家具',
        value: '893'
      },
      {
        cat0: '小型企业',
        date: '2018',
        cat1: '办公用品',
        group: '小型企业  办公用品',
        value: '1262'
      },
      {
        cat0: '公司',
        date: '2018',
        cat1: '技术',
        group: '公司  技术',
        value: '855'
      },
      {
        cat0: '小型企业',
        date: '2018',
        cat1: '技术',
        group: '小型企业  技术',
        value: '436'
      },
      {
        cat0: '公司',
        date: '2018',
        cat1: '办公用品',
        group: '公司  办公用品',
        value: '2218'
      },
      {
        cat0: '小型企业',
        date: '2019',
        cat1: '办公用品',
        group: '小型企业  办公用品',
        value: '692'
      },
      {
        cat0: '公司',
        date: '2019',
        cat1: '办公用品',
        group: '公司  办公用品',
        value: '1177'
      },
      {
        cat0: '公司',
        date: '2019',
        cat1: '家具',
        group: '公司  家具',
        value: '482'
      },
      {
        cat0: '公司',
        date: '2019',
        cat1: '技术',
        group: '公司  技术',
        value: '451'
      },
      {
        cat0: '小型企业',
        date: '2019',
        cat1: '家具',
        group: '小型企业  家具',
        value: '302'
      },
      {
        cat0: '小型企业',
        date: '2019',
        cat1: '技术',
        group: '小型企业  技术',
        value: '229'
      }
    ]
  },
  outerRadius: 0.9,
  axes: [
    {
      orient: 'radius',
      min: 0,
      domainLine: {
        visible: true
      },
      label: {
        visible: true
      },
      grid: {
        smooth: true
      }
    },
    {
      orient: 'angle',
      tick: {
        visible: false
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  legends: {
    orient: 'bottom',
    type: 'discrete',
    maxRow: 1,
    maxCol: 1,
    data: (data, colorScale, globalScale) => {
      return data.map(entry => {
        return {
          ...entry,
          shape: {
            ...entry.shape,
            fill: globalScale.getScale('legendColor').scale(entry.label)
          }
        };
      });
    },
    scaleName: 'legendColor',
    field: 'cat0',
    allowAllCanceled: false,
    item: {
      label: {
        style: {
          fontSize: 12
        }
      }
    }
  },
  label: {
    visible: true,
    style: {
      fontSize: 12
    }
  },
  scales: [
    {
      domain: ['小型企业  家具', '小型企业  技术', '小型企业  办公用品', '公司  技术', '公司  家具', '公司  办公用品'],
      id: 'color',
      type: 'ordinal',
      range: ['#1664FF', '#1664FF', '#1664FF', '#1AC6FF', '#1AC6FF', '#1AC6FF']
    },

    {
      id: 'legendColor',
      type: 'ordinal',
      domain: ['小型企业', '公司'],
      range: ['#1664FF', '#1AC6FF']
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程
