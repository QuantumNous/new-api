---
category: demo
group: axis
title: 坐标轴标签整体对齐
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-8
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/label-container-align.png
option: barChart#axes
---

# 坐标轴标签整体对齐

对于直角坐标系的坐标轴，我们可以通过在 `label` 上配置 `containerAlign` 属性来对所有的 label 进行整体的对齐方式调整。

## 关键配置

在 `axes` 属性上为指定方向的坐标轴配置 `label: { containerAlign: 'center' }` 可以让 label 整体居中展示

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  series: [
    {
      id: 'mainSeries',
      type: 'bar',
      direction: 'horizontal',
      yField: 'type',
      xField: 'value',
      regionId: 'mainRegion',
      seriesField: 'category',
      data: {
        id: 'mainSeriesData',
        values: [
          {
            value: '19173',
            category: 'count',
            type: 'consumer'
          },
          {
            value: '11581',
            category: 'count',
            type: 'company'
          },
          {
            value: '6780',
            category: 'count',
            type: 'small company'
          }
        ],
        fields: {
          value: {
            alias: 'Index value (principal axis)'
          },
          category: {
            alias: 'legend item',
            domain: ['count', 'profit']
          },
          type: {
            alias: 'detail',
            domain: ['company', 'consumer', 'small company']
          }
        }
      }
    },
    {
      id: 'subSeries',
      type: 'bar',
      direction: 'horizontal',
      yField: 'type',
      xField: 'value',
      regionId: 'subRegion',
      seriesField: 'category',
      data: {
        id: 'subSeriesData',
        values: [
          {
            value: '1053092.6314019188',
            category: 'profit',
            type: 'consumer'
          },
          {
            value: '681967.6347733513',
            category: 'profit',
            type: 'company'
          },
          {
            value: '412478.6609529555',
            category: 'profit',
            type: 'small company'
          }
        ],
        fields: {
          value: {
            alias: 'Indicator value (secondary axis)'
          },
          category: {
            alias: 'legend item',
            domain: ['count', 'profit']
          },
          type: {
            alias: 'detail',
            domain: ['company', 'consumer', 'small company']
          }
        }
      }
    }
  ],
  region: [
    {
      id: 'mainRegion'
    },
    {
      id: 'subRegion'
    }
  ],
  layout: {
    type: 'grid',
    row: 2,
    col: 4,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        row: 0,
        rowSpan: 2
      },
      {
        modelId: 'mainRegion',
        col: 1,
        row: 0
      },
      {
        modelId: 'dimensionAxis',
        col: 2,
        row: 0
      },
      {
        modelId: 'subRegion',
        col: 3,
        row: 0
      },
      {
        modelId: 'measureAxisLeft',
        col: 1,
        row: 1
      },
      {
        modelId: 'measureAxisRight',
        col: 3,
        row: 1
      }
    ]
  },
  axes: [
    {
      id: 'dimensionAxis',
      type: 'band',
      orient: 'left',
      label: {
        flush: true,
        containerAlign: 'center',
        space: 0
      },
      hover: true,
      background: {
        visible: true,
        state: {
          hover: {
            fillOpacity: 0.08,
            fill: '#141414'
          },
          hover_reverse: {
            fillOpacity: 0.08,
            fill: '#141414'
          }
        }
      },
      minWidth: 150, // Configure minimum width
      maxWidth: 500,
      regionId: ['mainRegion', 'subRegion'],
      seriesId: ['mainSeries', 'subSeries']
    },
    {
      id: 'measureAxisLeft',
      type: 'linear',
      orient: 'bottom',
      regionId: 'mainRegion',
      seriesId: 'mainSeries',
      inverse: true,
      label: {
        flush: true
      }
    },
    {
      id: 'measureAxisRight',
      type: 'linear',
      orient: 'bottom',
      regionId: 'subRegion',
      seriesId: 'subSeries',
      label: {
        flush: true
      }
    }
  ],
  seriesField: 'category',
  legends: [
    {
      visible: true,
      id: 'legend',
      orient: 'left',
      position: 'middle'
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
