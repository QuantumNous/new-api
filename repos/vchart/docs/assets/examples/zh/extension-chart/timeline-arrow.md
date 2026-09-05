---
category: examples
group: extension chart
title: 时间轴图-带箭头连接
keywords: extension, timeline, arrow
order: 5
cover: /vchart/preview/timeline-arrow_2.0.jpeg
option: extensionChart
---

# 时间轴图-带箭头连接

时间轴图支持在事件节点之间显示箭头，更直观地展示时间流向和事件之间的连贯性。

## 关键配置

- `arrow.visible: true` 启用箭头显示
- `arrow.thickness` 设置箭头的粗细
- `arrow.style` 配置箭头样式

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
          title: '需求分析',
          detail: '收集并分析用户需求',
          time: 1,
          color: '#4A90E2'
        },
        {
          id: '2',
          title: '方案设计',
          detail: '制定技术方案',
          time: 2,
          color: '#50C8C8'
        },
        {
          id: '3',
          title: '开发实现',
          detail: '编码开发功能',
          time: 3,
          color: '#F5A623'
        },
        {
          id: '4',
          title: '测试验收',
          detail: '质量保证与验收',
          time: 4,
          color: '#9B59B6'
        },
        {
          id: '5',
          title: '上线发布',
          detail: '正式发布上线',
          time: 5,
          color: '#2ECC71'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: '项目开发流程',
    subtext: '从需求到上线的完整流程',
    style: {
      fontSize: 24,
      fontWeight: 'bold',
      fill: '#333'
    },
    subtextStyle: {
      fontSize: 14,
      fill: '#666'
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
      arrow: {
        visible: true,
        thickness: 16,
        style: {
          fill: datum => datum.color,
          fillOpacity: 0.3
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
        visible: false
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
