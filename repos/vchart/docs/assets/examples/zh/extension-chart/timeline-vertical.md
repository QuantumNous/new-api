---
category: examples
group: extension chart
title: 时间轴图-垂直布局
keywords: extension, timeline, vertical
order: 3
cover: /vchart/preview/timeline-vertical_2.0.jpeg
option: extensionChart
---

# 时间轴图-垂直布局

时间轴图支持垂直布局，时间从上到下展开，适合在页面左右空间充足时使用。

## 关键配置

- `direction: 'vertical'` 指定为垂直布局
- `labelPosition: 'left-right' | 'right-left'` 控制标签在左右侧的交替显示

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
  direction: 'vertical',
  data: [
    {
      id: 'timeline-data',
      values: [
        {
          id: '1',
          year: '2021 Q1',
          title: 'V1.0 发布',
          detail: '首个正式版本上线',
          time: 1,
          color: '#4A90E2'
        },
        {
          id: '2',
          year: '2021 Q3',
          title: 'V2.0 升级',
          detail: '性能优化50%',
          time: 2,
          color: '#50C8C8'
        },
        {
          id: '3',
          year: '2022 Q1',
          title: 'V3.0 重构',
          detail: '架构全面升级',
          time: 3,
          color: '#F5A623'
        },
        {
          id: '4',
          year: '2022 Q3',
          title: 'V4.0 国际化',
          detail: '支持多语言',
          time: 4,
          color: '#9B59B6'
        },
        {
          id: '5',
          year: '2023 Q1',
          title: 'V5.0 智能化',
          detail: '引入AI能力',
          time: 5,
          color: '#E74C3C'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: '产品版本迭代历程',
    style: {
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#333'
    }
  },
  timeField: 'time',
  eventField: 'title',
  subTitleField: 'detail',
  labelPosition: 'left-right',
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
      fontSize: 14,
      fontWeight: 'bold'
    }
  },
  subTitle: {
    style: {
      fill: '#666',
      fontSize: 12
    }
  },
  line: {
    style: {
      stroke: '#c0c3c7',
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
