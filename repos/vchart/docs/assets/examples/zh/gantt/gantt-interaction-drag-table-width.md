---
category: examples
group: gantt chart
title: 甘特图交互-拖拽表格宽度
keywords: ganttChart
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/gantt-interaction-drag-table-width-preview.gif
link: '../guide/gantt/introduction'
option: Gantt#frame.verticalSplitLineMoveable
---

# 甘特图交互-拖拽表格宽度

甘特图介绍：https://visactor.io/vtable/guide/gantt/Getting_Started。

该示例展示了如何实现甘特图左侧任务信息表格的宽度可拖拽。配置项 `frame.verticalSplitLineMoveable` 为 `true` 时，左侧任务信息表格的垂直分割线可拖拽。如果想在 hover 时高亮垂直分割线时的颜色，可以配置 `frame.verticalSplitLineHighlight` 。限制拖拽宽度的范围，可以配置`listTable.minWidth` 和 `listTable.maxWidth` 。

## 关键配置

- `VTable`
- `Gantt`
- `frame.verticalSplitLineMoveable` 垂直分割线是否可移动
- `frame.verticalSplitLineHighlight`列调整宽度的高亮线样式

## 代码演示

```javascript livedemo template=vtable
// import * as VTableGantt from '@visactor/vtable-gantt';
let ganttInstance;
const records = [
  {
    id: 1,
    title: 'Software Development',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-24',
    end: '2024-08-15',
    progress: 31,
    priority: 'P0',
    children: [
      {
        id: 2,
        title: 'Project Feature Review',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-24',
        end: '2024-07-24',
        progress: 60,
        priority: 'P0'
      },
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024/07/25',
        end: '2024/07/26',
        progress: 100,
        priority: 'P1'
      },
      {
        id: 3,
        title: 'Project Create',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024/07/27',
        end: '2024/07/26',
        progress: 100,
        priority: 'P1'
      },
      {
        id: 3,
        title: 'Develop feature 1',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024/08/01',
        end: '2024/08/15',
        progress: 0,
        priority: 'P1'
      }
    ]
  },
  {
    id: 2,
    title: 'Scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '07/24/2024',
    end: '08/04/2024',
    progress: 60,
    priority: 'P0'
  },
  {
    id: 3,
    title: 'Determine project scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-24',
    end: '2024-08-04',
    progress: 100,
    priority: 'P1',
    children: [
      {
        id: 1,
        title: 'Software Development',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-08-01',
        end: '2024-08-01',
        progress: 90,
        priority: 'P0'
      },
      {
        id: 1,
        title: 'Software Development',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-30',
        end: '2024-08-04',
        progress: 31,
        priority: 'P0'
      },
      {
        id: 2,
        title: 'Scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024.07.26',
        end: '2024.07.08',
        progress: 60,
        priority: 'P0'
      },
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-29',
        end: '2024-07-31',
        progress: 100,
        priority: 'P1'
      },
      {
        id: 1,
        title: 'Software Development',
        developer: 'liufangfang.jane@bytedance.com',
        start: '07.24.2024',
        end: '08.04.2024',
        progress: 31,
        priority: 'P0'
      },
      {
        id: 2,
        title: 'Scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-16',
        end: '2024-07-18',
        progress: 60,
        priority: 'P0'
      },
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-08-09',
        end: '2024-09-11',
        progress: 100,
        priority: 'P1'
      }
    ]
  },

  {
    id: 1,
    title: 'Software Development',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-24',
    end: '2024-08-04',
    progress: 31,
    priority: 'P0'
  },
  {
    id: 2,
    title: 'Scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-26',
    end: '2024-07-28',
    progress: 60,
    priority: 'P0',
    children: [
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-29',
        end: '2024-07-31',
        progress: 100,
        priority: 'P1',
        children: [
          {
            id: 1,
            title: 'Software Development',
            developer: 'liufangfang.jane@bytedance.com',
            start: '2024-07-24',
            end: '2024-08-04',
            progress: 31,
            priority: 'P0'
          },
          {
            id: 2,
            title: 'Scope',
            developer: 'liufangfang.jane@bytedance.com',
            start: '2024-07-26',
            end: '2024-07-28',
            progress: 60,
            priority: 'P0'
          },
          {
            id: 3,
            title: 'Determine project scope',
            developer: 'liufangfang.jane@bytedance.com',
            start: '2024-07-29',
            end: '2024-07-31',
            progress: 100,
            priority: 'P1'
          }
        ]
      },
      {
        id: 1,
        title: 'Software Development',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-24',
        end: '2024-08-04',
        progress: 31,
        priority: 'P0',
        children: [
          {
            id: 1,
            title: 'Software Development',
            developer: 'liufangfang.jane@bytedance.com',
            start: '2024-07-24',
            end: '2024-08-04',
            progress: 31,
            priority: 'P0'
          },
          {
            id: 2,
            title: 'Scope',
            developer: 'liufangfang.jane@bytedance.com',
            start: '2024-07-06',
            end: '2024-07-08',
            progress: 60,
            priority: 'P0'
          },
          {
            id: 3,
            title: 'Determine project scope',
            developer: 'liufangfang.jane@bytedance.com',
            start: '2024-07-29',
            end: '2024-07-31',
            progress: 100,
            priority: 'P1'
          }
        ]
      },
      {
        id: 2,
        title: 'Scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-26',
        end: '2024-07-28',
        progress: 60,
        priority: 'P0'
      },
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-29',
        end: '2024-07-31',
        progress: 100,
        priority: 'P1',
        children: [
          {
            id: 1,
            title: 'Software Development',
            developer: 'liufangfang.jane@bytedance.com',
            start: '2024-07-24',
            end: '2024-08-04',
            progress: 31,
            priority: 'P0'
          },
          {
            id: 2,
            title: 'Scope',
            developer: 'liufangfang.jane@bytedance.com',
            start: '2024-07-06',
            end: '2024-07-08',
            progress: 60,
            priority: 'P0'
          }
        ]
      },
      {
        id: 1,
        title: 'Software Development',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-24',
        end: '2024-08-04',
        progress: 31,
        priority: 'P0'
      },
      {
        id: 2,
        title: 'Scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-26',
        end: '2024-07-28',
        progress: 60,
        priority: 'P0'
      },
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-29',
        end: '2024-07-31',
        progress: 100,
        priority: 'P1'
      }
    ]
  },

  {
    id: 3,
    title: 'Determine project scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-29',
    end: '2024-07-31',
    progress: 100,
    priority: 'P1',
    children: [
      {
        id: 1,
        title: 'Software Development',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-24',
        end: '2024-08-04',
        progress: 31,
        priority: 'P0'
      },
      {
        id: 2,
        title: 'Scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-23',
        end: '2024-07-28',
        progress: 60,
        priority: 'P0'
      },
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-29',
        end: '2024-07-31',
        progress: 100,
        priority: 'P1'
      },
      {
        id: 1,
        title: 'Software Development',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-30',
        end: '2024-08-14',
        progress: 31,
        priority: 'P0'
      },
      {
        id: 2,
        title: 'Scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-24',
        end: '2024-08-04',
        progress: 60,
        priority: 'P0'
      }
    ]
  },
  {
    id: 1,
    title: 'Software Development',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-24',
    end: '2024-08-04',
    progress: 31,
    priority: 'P0',
    children: [
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024/07/24',
        end: '2024/08/04',
        progress: 100,
        priority: 'P1'
      },
      {
        id: 1,
        title: 'Software Development',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-08-04',
        end: '2024-08-04',
        progress: 90,
        priority: 'P0'
      },
      {
        id: 2,
        title: 'Scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '07/24/2024',
        end: '08/04/2024',
        progress: 60,
        priority: 'P0'
      }
    ]
  },
  {
    id: 2,
    title: 'Scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-27',
    end: '2024-07-28',
    progress: 60,
    priority: 'P0'
  },
  {
    id: 3,
    title: 'Determine project scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-29',
    end: '2024-07-31',
    progress: 100,
    priority: 'P1',
    children: [
      {
        id: 1,
        title: 'Software Development',
        developer: 'liufangfang.jane@bytedance.com',
        start: '07.24.2024',
        end: '08.04.2024',
        progress: 31,
        priority: 'P0'
      },
      {
        id: 2,
        title: 'Scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-26',
        end: '2024-07-28',
        progress: 60,
        priority: 'P0'
      },
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-08-09',
        end: '2024-09-11',
        progress: 100,
        priority: 'P1'
      },
      {
        id: 1,
        title: 'Software Development',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-24',
        end: '2024-08-04',
        progress: 31,
        priority: 'P0'
      },
      {
        id: 2,
        title: 'Scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-26',
        end: '2024-07-28',
        progress: 60,
        priority: 'P0'
      },
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-29',
        end: '2024-07-31',
        progress: 100,
        priority: 'P1'
      },
      {
        id: 1,
        title: 'Software Development',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-24',
        end: '2024-08-04',
        progress: 31,
        priority: 'P0'
      },
      {
        id: 2,
        title: 'Scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-26',
        end: '2024-07-28',
        progress: 60,
        priority: 'P0'
      },
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-29',
        end: '2024-07-31',
        progress: 100,
        priority: 'P1'
      }
    ]
  },
  {
    id: 1,
    title: 'Software Development',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-24',
    end: '2024-08-04',
    progress: 31,
    priority: 'P0',
    children: [
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-24',
        end: '2024-08-04',
        progress: 100,
        priority: 'P1'
      },
      {
        id: 1,
        title: 'Software Development',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-24',
        end: '2024-08-04',
        progress: 31,
        priority: 'P0'
      },
      {
        id: 2,
        title: 'Scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024.07.06',
        end: '2024.07.08',
        progress: 60,
        priority: 'P0'
      },
      {
        id: 3,
        title: 'Determine project scope',
        developer: 'liufangfang.jane@bytedance.com',
        start: '2024-07-29',
        end: '2024-07-31',
        progress: 100,
        priority: 'P1'
      }
    ]
  }
];

const columns = [
  {
    field: 'title',
    title: 'title',
    width: 'auto',
    sort: true,
    tree: true,
    editor: 'input'
  },
  {
    field: 'start',
    title: 'start',
    width: 'auto',
    sort: true,
    editor: 'date-input'
  },
  {
    field: 'end',
    title: 'end',
    width: 'auto',
    sort: true,
    editor: 'date-input'
  },
  {
    field: 'priority',
    title: 'priority',
    width: 'auto',
    sort: true,
    editor: 'input'
  },
  {
    field: 'progress',
    title: 'progress',
    width: 'auto',
    sort: true,
    headerStyle: {
      borderColor: '#e1e4e8'
    },
    style: {
      borderColor: '#e1e4e8',
      color: 'green'
    },
    editor: 'input'
  }
];
const option = {
  overscrollBehavior: 'none',
  records,
  taskListTable: {
    columns,
    tableWidth: 250,
    minTableWidth: 100,
    maxTableWidth: 600
  },
  grid: {
    verticalLine: {
      lineWidth: 1,
      lineColor: '#e1e4e8'
    }
  },
  headerRowHeight: 40,
  rowHeight: 40,
  taskBar: {
    startDateField: 'start',
    endDateField: 'end',
    progressField: 'progress',
    // resizable: false,
    moveable: true,
    hoverBarStyle: {
      barOverlayColor: 'rgba(99, 144, 0, 0.4)'
    }
  },
  frame: {
    verticalSplitLineMoveable: true
  },
  timelineHeader: {
    colWidth: 100,
    backgroundColor: '#EEF1F5',
    horizontalLine: {
      lineWidth: 1,
      lineColor: '#e1e4e8'
    },
    verticalLine: {
      lineWidth: 1,
      lineColor: '#e1e4e8'
    },
    scales: [
      {
        unit: 'week',
        step: 1,
        startOfWeek: 'sunday',
        format(date) {
          return `Week ${date.dateIndex}`;
        },
        style: {
          fontSize: 20,
          fontWeight: 'bold',
          color: 'white',
          strokeColor: 'black',
          textAlign: 'right',
          textBaseline: 'bottom',
          backgroundColor: '#EEF1F5',
          textStick: true
          // padding: [0, 30, 0, 20]
        }
      },
      {
        unit: 'day',
        step: 1,
        format(date) {
          return date.dateIndex.toString();
        },
        style: {
          fontSize: 20,
          fontWeight: 'bold',
          color: 'white',
          strokeColor: 'black',
          textAlign: 'right',
          textBaseline: 'bottom',
          backgroundColor: '#EEF1F5'
        }
      }
    ]
  },
  markLine: [
    {
      date: '2024-07-28',
      style: {
        lineWidth: 1,
        lineColor: 'blue',
        lineDash: [8, 4]
      }
    },
    {
      date: '2024-08-17',
      style: {
        lineWidth: 2,
        lineColor: 'red',
        lineDash: [8, 4]
      }
    }
  ],
  rowSeriesNumber: {
    title: '行号',
    dragOrder: true,
    headerStyle: {
      bgColor: '#EEF1F5',
      borderColor: '#e1e4e8'
    },
    style: {
      borderColor: '#e1e4e8'
    }
  },
  scrollStyle: {
    scrollRailColor: 'RGBA(246,246,246,0.5)',
    visible: 'scrolling',
    width: 6,
    scrollSliderCornerRadius: 2,
    scrollSliderColor: '#5cb85c'
  }
};
ganttInstance = new VTableGantt.Gantt(document.getElementById(CONTAINER_ID), option);
window['ganttInstance'] = ganttInstance;
```
