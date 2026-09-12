---
category: examples
group: pie
title: 平滑标签线的饼图
keywords: pieChart,comparison,composition,proportion,circle
order: 6-8
cover: /vchart/preview/pie-chart/smooth-label-line_1.4.0.png
option: pieChart
---

# 平滑标签线的饼图

饼图当设置外标签时，会出现文字标签与扇形图元之间的引导线。该引导线默认为折线，也可通过配置设置为平滑曲线。

## 关键配置

- `line.smooth` 属性用于控制标签引导线是否平滑，默认设置为`false`

## 代码演示

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      name: 'data1',
      values: [
        {
          value: 348,
          name: '中介渠道: 34.8%'
        },
        {
          value: 152,
          name: '会员: 15.2%'
        },
        {
          value: 500,
          name: '散客: 50%'
        }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'name',
  outerRadius: 0.8,
  innerRadius: 0.5,
  color: ['#87DBDD', '#FF8406', '#468DFF'],
  pie: {
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
  legends: {
    visible: true,
    orient: 'right',
    title: {
      visible: false
    },
    item: {
      visible: true
    }
  },
  tooltip: {
    transitionDuration: 0
  },
  label: {
    visible: true,
    pickable: false,
    line: {
      smooth: true,
      style: {
        lineWidth: 2
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)
