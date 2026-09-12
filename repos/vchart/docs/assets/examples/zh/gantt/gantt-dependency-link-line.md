---
category: examples
group: gantt chart
title: Gantt Dependency Link Line
keywords: ganttChart
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/gantt-dependency-link-line.gif
link: '../guide/gantt/introduction'
option: Gantt#taskBar
---

# 甘特图依赖线

甘特图介绍：https://visactor.io/vtable/guide/gantt/Getting_Started。

甘特图依赖线是甘特图中用来表示任务之间的依赖关系的线条，它可以帮助用户更好地理解任务之间的关系，并帮助用户进行任务的排序和调度。
该示例展示了如何在甘特图中添加依赖线，并配置依赖线的样式。

## 关键配置

- `VTable`
- `Gantt`
- `Gantt#dependency.links` 配置任务条之间前后依赖关系的数据
- `Gantt#dependency.linkLineStyle` 配置依赖线的样式
- `Gantt#dependency.linkLineSelectedStyle` 配置依赖线选中时的样式

## 代码演示

```javascript livedemo template=vtable
// import * as VTableGantt from '@visactor/vtable-gantt';
let ganttInstance;
const records = [
  {
    id: 1,
    title: 'Software Development',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-15',
    end: '2024-07-16',
    progress: 31,
    priority: 'P0'
  },
  {
    id: 2,
    title: 'Scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-16',
    end: '2024-07-17',
    progress: 60,
    priority: 'P0'
  },
  {
    id: 3,
    title: 'Software Development',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-18',
    end: '2024-07-19',
    progress: 90,
    priority: 'P0'
  },
  {
    id: 4,
    title: 'Determine project scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024/07/17',
    end: '2024/07/18',
    progress: 100,
    priority: 'P1'
  },
  {
    id: 5,
    title: 'Scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '07/19/2024',
    end: '07/20/2024',
    progress: 60,
    priority: 'P0'
  },
  {
    id: 6,
    title: 'Determine project scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-24',
    end: '2024-08-04',
    progress: 100,
    priority: 'P1'
  },
  {
    id: 7,
    title: 'Software Development',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-24',
    end: '2024-08-04',
    progress: 31,
    priority: 'P0'
  },
  {
    id: 8,
    title: 'Scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024.07.06',
    end: '2024.07.08',
    progress: 60,
    priority: 'P0'
  },
  {
    id: 9,
    title: 'Determine project scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024/07/09',
    end: '2024/07/11',
    progress: 100,
    priority: 'P1'
  },
  {
    id: 10,
    title: 'Software Development',
    developer: 'liufangfang.jane@bytedance.com',
    start: '07.24.2024',
    end: '08.04.2024',
    progress: 31,
    priority: 'P0'
  },

  {
    id: 11,
    title: 'Software Development',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-24',
    end: '2024-08-04',
    progress: 31,
    priority: 'P0'
  },
  {
    id: 12,
    title: 'Scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-06',
    end: '2024-07-08',
    progress: 60,
    priority: 'P0'
  },
  {
    id: 13,
    title: 'Determine project scope',
    developer: 'liufangfang.jane@bytedance.com',
    start: '2024-07-09',
    end: '2024-07-11',
    progress: 100,
    priority: 'P1'
  }
];

const columns = [
  {
    field: 'title',
    title: 'title',
    width: 'auto',
    tree: true
  },
  {
    field: 'start',
    title: 'start',
    width: 'auto',
    editor: 'date-input'
  },
  {
    field: 'end',
    title: 'end',
    width: 'auto',
    editor: 'date-input'
  },
  {
    field: 'priority',
    title: 'priority',
    width: 'auto',
    editor: 'input'
  },
  {
    field: 'progress',
    title: 'progress',
    width: 'auto',
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
  records,
  taskListTable: {
    columns: columns,
    tableWidth: 400,
    minTableWidth: 100,
    maxTableWidth: 600
  },
  dependency: {
    links: [
      {
        type: VTableGantt.TYPES.DependencyType.FinishToStart,
        linkedFromTaskKey: 1,
        linkedToTaskKey: 2
      },
      {
        type: VTableGantt.TYPES.DependencyType.StartToFinish,
        linkedFromTaskKey: 2,
        linkedToTaskKey: 3
      },
      {
        type: VTableGantt.TYPES.DependencyType.StartToStart,
        linkedFromTaskKey: 3,
        linkedToTaskKey: 4
      },
      {
        type: VTableGantt.TYPES.DependencyType.FinishToFinish,
        linkedFromTaskKey: 4,
        linkedToTaskKey: 5
      }
    ],
    // linkSelectable: false,
    linkSelectedLineStyle: {
      shadowBlur: 5, //阴影宽度
      shadowColor: 'red',
      lineColor: 'red',
      lineWidth: 1
    }
  },
  frame: {
    verticalSplitLineMoveable: true,
    outerFrameStyle: {
      borderLineWidth: 2,
      borderColor: 'red',
      cornerRadius: 8
    },
    verticalSplitLine: {
      lineWidth: 3,
      lineColor: '#e1e4e8'
    },
    verticalSplitLineHighlight: {
      lineColor: 'green',
      lineWidth: 3
    }
  },
  grid: {
    // backgroundColor: 'gray',
    verticalLine: {
      lineWidth: 1,
      lineColor: '#e1e4e8'
    },
    horizontalLine: {
      lineWidth: 1,
      lineColor: '#e1e4e8'
    }
  },
  headerRowHeight: 60,
  rowHeight: 40,

  taskBar: {
    startDateField: 'start',
    endDateField: 'end',
    progressField: 'progress',
    labelText: '{title} {progress}%',
    labelTextStyle: {
      fontFamily: 'Arial',
      fontSize: 16,
      textAlign: 'left'
    },
    barStyle: {
      width: 20,
      /** 任务条的颜色 */
      barColor: '#ee8800',
      /** 已完成部分任务条的颜色 */
      completedBarColor: '#91e8e0',
      /** 任务条的圆角 */
      cornerRadius: 10
    },
    selectedBarStyle: {
      shadowBlur: 5, //阴影宽度
      shadowOffsetX: 0, //x方向偏移
      shadowOffsetY: 0, //Y方向偏移
      shadowColor: 'black', //阴影颜色
      borderColor: 'red', //边框颜色
      borderLineWidth: 1 //边框宽度
    }
  },
  timelineHeader: {
    verticalLine: {
      lineWidth: 1,
      lineColor: '#e1e4e8'
    },
    horizontalLine: {
      lineWidth: 1,
      lineColor: '#e1e4e8'
    },
    backgroundColor: '#EEF1F5',
    colWidth: 60,
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
          color: 'red'
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
          color: 'red'
        }
      }
    ]
  },
  minDate: '2024-07-14',
  maxDate: '2024-10-15',

  rowSeriesNumber: {
    title: '行号',
    dragOrder: true,
    headerStyle: {
      bgColor: '#EEF1F5',
      borderColor: '#e1e4e8'
    },
    style: {
      color: '#000',
      fontSize: 14
    }
  },
  scrollStyle: {
    visible: 'scrolling'
  },
  overscrollBehavior: 'none'
};
ganttInstance = new VTableGantt.Gantt(document.getElementById(CONTAINER_ID), option);
window['ganttInstance'] = ganttInstance;
```
