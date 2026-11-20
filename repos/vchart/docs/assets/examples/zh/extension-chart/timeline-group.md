---
category: examples
group: extension chart
title: 时间轴图-分组展示
keywords: extension, timeline, group
order: 4
cover: /vchart/preview/timeline-group_2.0.jpeg
option: extensionChart
---

# 时间轴图-分组展示

通过配置 seriesField，可以在同一个图表中展示多条时间轴，适合对比展示不同主题或类别的时间线。

## 关键配置

- `seriesField` 指定分组字段
- 多条时间轴会并行显示，每条时间轴独立展示

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外依赖 @visactor/vchart-extension，包版本保持和vchart一致
// import { registerTimelineChart } from '@visactor/vchart-extension';
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
const { registerTimelineChart } = VChartExtension;
/** --在业务中使用时请删除以上代码-- */

const spec = {
  type: 'timeline',
  direction: 'horizontal',
  padding: {
    left: 60,
    right: 60,
    top: 100,
    bottom: 100
  },
  data: [
    {
      id: 'timeline-data',
      values: [
        {
          category: '产品线A',
          title: 'V1.0',
          detail: '首次发布',
          time: 1,
          color: '#4A90E2'
        },
        {
          category: '产品线A',
          title: 'V2.0',
          detail: '功能增强',
          time: 3,
          color: '#4A90E2'
        },
        {
          category: '产品线A',
          title: 'V3.0',
          detail: '性能优化',
          time: 5,
          color: '#4A90E2'
        },
        {
          category: '产品线B',
          title: 'Beta',
          detail: '测试版本',
          time: 2,
          color: '#50C8C8'
        },
        {
          category: '产品线B',
          title: 'V1.0',
          detail: '正式发布',
          time: 4,
          color: '#50C8C8'
        },
        {
          category: '产品线B',
          title: 'V2.0',
          detail: '重大更新',
          time: 6,
          color: '#50C8C8'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: '多产品线发展对比',
    style: {
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#333'
    }
  },

  timeField: 'time',
  eventField: 'title',
  subTitleField: 'detail',
  seriesField: 'category',
  labelPosition: 'top-bottom',
  dot: {
    style: {
      size: 12,
      fill: datum => datum.color,
      stroke: '#fff',
      lineWidth: 2
    }
  },
  title: {
    style: {
      fill: '#333',
      fontSize: 13,
      fontWeight: 'bold'
    }
  },
  subTitle: {
    style: {
      fill: '#666',
      fontSize: 11
    }
  },
  line: {
    style: {
      stroke: datum => datum.color,
      lineWidth: 2
    }
  }
};

registerTimelineChart();
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[扩展图表：时间轴图](/vchart/guide/tutorial_docs/Chart_Extensions/timeline)
