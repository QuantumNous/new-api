---
category: examples
group: gantt chart
title: 甘特图交互-拖拽任务条
keywords: ganttChart
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/gantt-interaction-drag-taskBar-preview.gif
link: '../guide/gantt/introduction'
option: Gantt#taskBar.moveable
---

# 甘特图交互-拖拽任务条

甘特图介绍：https://visactor.io/vtable/guide/gantt/Getting_Started。

该示例展示了如何实现甘特图任务条的拖拽功能。移动任务条能力和调整大小能力是默认开启的，可通过配置项关闭。
配置项分别为`taskBar.moveable`和`taskBar.resizable`。

## 关键配置

- `VTable`
- `Gantt`
- `Gantt#taskBar.moveable` 任务条是否可移动。默认为 true
- `Gantt#taskBar.resizable` 任务条是否可调整大小。默认为 true

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
    maxTableWidth: 600,
    theme: {
      headerStyle: {
        borderColor: '#9fb9c3',
        borderLineWidth: 0,
        fontSize: 18,
        fontWeight: 'bold',
        color: '#134e35',
        bgColor: '#a7c2ff'
      },
      bodyStyle: {
        borderColor: '#9fb9c3',
        borderLineWidth: [1, 0, 1, 0],
        fontSize: 16,
        color: '#134e35',
        bgColor: '#e1e7ff'
      }
    }
    //rightFrozenColCount: 1
  },
  frame: {
    outerFrameStyle: {
      borderLineWidth: 1,
      borderColor: '#e1e4e8',
      cornerRadius: 0
    },
    verticalSplitLine: {
      lineColor: '#e1e4e8',
      lineWidth: 1
    },
    horizontalSplitLine: {
      lineColor: '#e1e4e8',
      lineWidth: 1
    },
    verticalSplitLineMoveable: true,
    verticalSplitLineHighlight: {
      lineColor: 'green',
      lineWidth: 1
    }
  },
  grid: {
    backgroundColor: '#e1e7ff',
    horizontalLine: {
      lineWidth: 1,
      lineColor: '#9fb9c3'
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
    },
    barStyle: {
      width: 10,
      /** 任务条的颜色 */
      barColor: '#134e35',
      /** 已完成部分任务条的颜色 */
      completedBarColor: '#b9cdff',
      /** 任务条的圆角 */
      cornerRadius: 8,
      /** 任务条的边框 */
      borderWidth: 1,
      /** 边框颜色 */
      borderColor: 'black'
    }
  },
  timelineHeader: {
    colWidth: 100,
    backgroundColor: '#a7c2ff',
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
        unit: 'day',
        step: 1,
        format(date) {
          return date.dateIndex.toString();
        },
        style: {
          fontSize: 20,
          fontWeight: 'bold',
          color: '#134e35',
          textAlign: 'right',
          textBaseline: 'bottom',
          backgroundColor: '#a7c2ff'
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
      fontWeight: 'bold',
      color: '#134e35',
      bgColor: '#a7c2ff'
    },
    style: {
      borderColor: '#e1e4e8',
      borderColor: '#9fb9c3',
      borderLineWidth: [1, 0, 1, 0]
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
