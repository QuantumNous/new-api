---
category: examples
group: extension chart
title: 时间轴图-带图标
keywords: extension, timeline, icon
order: 2
cover: /vchart/preview/timeline-icon_2.0.jpeg
option: extensionChart
---

# 时间轴图-带图标

时间轴图支持在事件节点上添加图标，使信息展示更加直观和丰富。图标可以与标题关于时间轴对称显示。

## 关键配置

- `iconField` 指定图标字段
- `icon.style` 配置图标样式
- 图标与标题关于时间轴对称：当标题在上方时，图标在下方；当标题在左侧时，图标在右侧

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
  data: [
    {
      id: 'timeline-data',
      values: [
        {
          id: '1',
          year: '2021',
          title: '产品发布',
          detail: '发布第一代产品，获得市场认可',
          icon: 'star',
          time: 1,
          color: '#4A90E2'
        },
        {
          id: '2',
          year: '2022',
          title: '技术突破',
          detail: '核心技术获得重大突破',
          icon: 'triangleUp',
          time: 2,
          color: '#50C8C8'
        },
        {
          id: '3',
          year: '2023',
          title: '市场扩展',
          detail: '业务覆盖全国主要城市',
          icon: 'diamond',
          time: 3,
          color: '#F5A623'
        },
        {
          id: '4',
          year: '2024',
          title: '国际化',
          detail: '进军国际市场，开启新篇章',
          icon: 'cross',
          time: 4,
          color: '#9B59B6'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: '企业发展历程 - 带图标',
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
      iconField: 'icon',
      labelPosition: 'top-bottom',
      dot: {
        style: {
          size: 10,
          fill: datum => datum.color,
          stroke: '#fff',
          lineWidth: 2
        }
      },
      icon: {
        visible: true,
        style: {
          size: 24,
          fill: datum => datum.color
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
          fontSize: 12,
          lineHeight: 18
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
