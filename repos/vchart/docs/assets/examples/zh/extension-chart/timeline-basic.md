---
category: examples
group: extension chart
title: 时间轴图-基础
keywords: extension, timeline
order: 1
cover: /vchart/preview/timeline-basic_2.0.jpeg
option: extensionChart
---

# 时间轴图-基础

时间轴图用于展示事件按时间顺序发生的过程，适合用于项目里程碑、企业发展历程、产品迭代等场景。

## 关键配置

- `type: 'timeline'` 指定图表类型为时间轴图
- `direction: 'horizontal' | 'vertical'` 指定时间轴的方向，水平或垂直
- `timeField` 指定时间字段
- `eventField` 指定事件名称字段
- `subTitleField` 指定事件详情字段

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
    top: 150,
    bottom: 150
  },
  data: [
    {
      id: 'timeline-data',
      values: [
        {
          id: '1',
          year: '2021',
          title: '产品发布',
          detail: '发布第一代产品，获得市场认可',
          time: 1,
          color: '#4A90E2'
        },
        {
          id: '2',
          year: '2022',
          title: '技术突破',
          detail: '核心技术获得重大突破',
          time: 2,
          color: '#50C8C8'
        },
        {
          id: '3',
          year: '2023',
          title: '市场扩展',
          detail: '业务覆盖全国主要城市',
          time: 3,
          color: '#F5A623'
        },
        {
          id: '4',
          year: '2024',
          title: '国际化',
          detail: '进军国际市场，开启新篇章',
          time: 4,
          color: '#9B59B6'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: '企业发展历程',
    style: {
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#333'
    }
  },
  series: [
    {
      type: 'event',
      dataId: 'timeline-data',
      timeField: 'time',
      eventField: 'title',
      subTitleField: 'detail',
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
    }
  ]
};

registerTimelineChart();
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[扩展图表：时间轴图](/vchart/guide/tutorial_docs/Chart_Extensions/timeline)
