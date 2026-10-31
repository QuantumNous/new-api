---
category: examples
group: storytelling
title: 饼图的三种内置入场动画
keywords: animation,pie,pieChart,comparison
order: 42-0
cover: /vchart/preview/pie-preset-animation_1.8.3.gif
option: pieChart#animationAppear
---

# 饼图的三种内置入场动画

## 关键配置

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  padding: {
    top: 10
  },
  layout: {
    type: 'grid',
    col: 3,
    row: 2,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        row: 1,
        colSpan: 3
      },
      {
        modelId: 'DAU',
        col: 0,
        row: 0
      },
      {
        modelId: '新增',
        col: 1,
        row: 0
      },
      {
        modelId: 'MAU',
        col: 2,
        row: 0
      }
    ]
  },
  region: [
    {
      id: 'DAU'
    },
    {
      id: '新增'
    },
    {
      id: 'MAU'
    }
  ],
  legends: {
    visible: true,
    orient: 'bottom',
    id: 'legend',
    regionId: ['DAU', '新增', 'MAU', 'DAU/MAU'],
    item: {
      visible: true,
      background: {
        style: {
          fill: 'transparent'
        }
      }
    }
  },
  series: [
    {
      id: 'DAUseries0',
      regionId: 'DAU',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: 'DAU',
        values: [
          {
            type: '首页',
            value: 120
          },
          {
            type: '大屏',
            value: 100
          },
          {
            type: '看板',
            value: 200
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    },
    {
      id: '新增series0',
      regionId: '新增',
      type: 'pie',
      animationAppear: {
        preset: 'fadeIn'
      },
      valueField: 'value',
      categoryField: 'type',
      data: {
        id: '新增',
        values: [
          {
            type: '首页',
            value: 80
          },
          {
            type: '大屏',
            value: 200
          },
          {
            type: '看板',
            value: 400
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    },

    {
      id: 'MAUseries0',
      regionId: 'MAU',
      type: 'pie',
      valueField: 'value',
      categoryField: 'type',
      animationAppear: {
        preset: 'growRadius'
      },
      data: {
        id: 'MAU',
        values: [
          {
            type: '首页',
            value: 123
          },
          {
            type: '大屏',
            value: 245
          },
          {
            type: '看板',
            value: 367
          }
        ]
      },
      seriesField: 'type',
      label: {
        style: {
          visible: false
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
```

## 相关教程

[散点图](link)
