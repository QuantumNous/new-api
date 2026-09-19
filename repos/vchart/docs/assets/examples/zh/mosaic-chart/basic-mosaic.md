---
category: examples
group: mosaic chart
title: 基础马赛克图
keywords: mosaic,comparison,distribution,rectangle,composition,proportion
cover: /vchart/preview/mosaic-chart-basic-mosaic_1.11.6.png
option: mosaicChart
---

# 基础马赛克图

马赛克图（Mosaic）英文学名为 Mosaic Plot，是分组显示数据百分比的一种特殊类型的堆叠柱状图；可以看作百分比对图柱图的一种扩展

## 关键配置

- `label` 属性配置多种标签

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入registerMosaicChart并执行
// import { registerMosaicChart } from '@visactor/vchart';
// registerMosaicChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerMosaicChart();
/** --在业务中使用时请删除以上代码-- */
const spec = {
  type: 'mosaic',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'WY',
          Age: 'Under 5 Years',
          Population: 25635
        },
        {
          State: 'WY',
          Age: '5 to 13 Years',
          Population: 1890
        },
        {
          State: 'WY',
          Age: '14 to 17 Years',
          Population: 9314
        },
        {
          State: 'DC',
          Age: 'Under 5 Years',
          Population: 30352
        },
        {
          State: 'DC',
          Age: '5 to 13 Years',
          Population: 20439
        },
        {
          State: 'DC',
          Age: '14 to 17 Years',
          Population: 10225
        },
        {
          State: 'VT',
          Age: 'Under 5 Years',
          Population: 38253
        },
        {
          State: 'VT',
          Age: '5 to 13 Years',
          Population: 42538
        },
        {
          State: 'VT',
          Age: '14 to 17 Years',
          Population: 15757
        },
        {
          State: 'ND',
          Age: 'Under 5 Years',
          Population: 51896
        },
        {
          State: 'ND',
          Age: '5 to 13 Years',
          Population: 67358
        },
        {
          State: 'ND',
          Age: '14 to 17 Years',
          Population: 18794
        },
        {
          State: 'AK',
          Age: 'Under 5 Years',
          Population: 72083
        },
        {
          State: 'AK',
          Age: '5 to 13 Years',
          Population: 85640
        },
        {
          State: 'AK',
          Age: '14 to 17 Years',
          Population: 22153
        }
      ]
    }
  ],

  label: [
    {
      visible: true,
      position: 'bottom',
      style: {
        fill: '#333'
      },
      filterByGroup: {
        field: 'State',
        type: 'min'
      },
      overlap: false,
      formatMethod: (value, datum, ctx) => {
        return datum['State'];
      }
    },

    {
      visible: true,
      position: 'top',
      style: {
        fill: '#333'
      },
      filterByGroup: {
        field: 'State',
        type: 'max'
      },
      overlap: false,
      formatMethod: (value, datum, ctx) => {
        return `${datum['__VCHART_STACK_END']} ( ${(
          (datum['__VCHART_MOSAIC_CAT_END_PERCENT'] - datum['__VCHART_MOSAIC_CAT_START_PERCENT']) *
          100
        ).toFixed(0)}% )`;
      }
    },
    {
      visible: true,
      position: 'center',
      smartInvert: true
    }
  ],
  xField: 'State',
  yField: 'Population',
  seriesField: 'Age',
  percent: true,
  legends: {
    visible: true
  },
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod: val => {
          return `${(val * 100).toFixed(2)}%`;
        }
      }
    },
    {
      orient: 'bottom',
      label: {
        visible: false
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

[柱状图](link)
