---
category: examples
group: gantt chart
title: 甘特图子任务布局模式
keywords: ganttChart
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/gantt-taskShowMode.gif
link: '../guide/gantt/subtask_layout'
option: Gantt#tasksShowMode
---

# 甘特图子任务布局模式

甘特图介绍：https://visactor.io/vtable/guide/gantt/Getting_Started。

在 Gantt 中，任务条布局模式决定了任务条的显示效果。Gantt 提供了以下几种任务条布局模式：

- `Tasks_Separate`: 每一个任务节点用单独一行来展示，父任务占用一行，子任务分别占用一行。这是默认的显示效果
- `Sub_Tasks_Separate`: 省去父任务节点不展示，且所有子任务的节点分别用一行展示。
- `Sub_Tasks_Inline`: 省去父任务节点不展示，并把所有子任务的节点都放到同一行来展示。
- `Sub_Tasks_Arrange`: 省去父任务节点不展示，且所有子任务会维持 records 中的数据顺序布局，并保证节点不重叠展示。
- `Sub_Tasks_Compact`: 省去父任务节点不展示，且所有子任务会按照日期早晚的属性来布局，并保证节点不重叠的紧凑型展示。

## 关键配置

- `VTable`
- `Gantt`
- `Gantt#tasksShowMode`

## 代码演示

```javascript livedemo template=vtable
// import * as VTableGantt from '@visactor/vtable-gantt';
let ganttInstance;
const records = [
  {
    id: 0,
    name: 'Planning',
    start: '2024-11-15',
    end: '2024-11-21',
    children: [
      {
        id: 1,
        name: 'Michael Smith',
        start: '2024-11-15',
        end: '2024-11-17',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/wolf.jpg'
      },
      {
        id: 2,
        name: 'Emily',
        start: '2024-11-17',
        end: '2024-11-18',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg'
      },
      {
        id: 3,
        name: 'Rramily',
        start: '2024-11-19',
        end: '2024-11-20',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg'
      },
      {
        id: 4,
        name: 'Lichael Join',
        start: '2024-11-18',
        end: '2024-11-19',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/wolf.jpg'
      }
    ]
  },
  {
    id: 300,
    name: 'Research',
    children: [
      {
        id: 5,
        name: 'Ryan',
        start: '2024-11-18',
        end: '2024-11-21',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/rabbit.jpg'
      }
    ]
  },
  {
    name: 'Goal Setting',
    children: [
      {
        id: 6,
        name: 'Daniel Davis',
        start: '2024-11-21',
        end: '2024-11-22',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/cat.jpg'
      },
      {
        id: 7,
        name: 'Lauren',
        start: '2024-11-18',
        end: '2024-11-19',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/flower.jpg'
      }
    ]
  },

  {
    name: 'Strategy',
    children: [
      {
        id: 8,
        name: 'Tacarah Siller',
        start: '2024-11-20',
        end: '2024-11-21',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg'
      },
      {
        id: 9,
        name: 'Camentew Olision',
        start: '2024-11-25',
        end: '2024-11-26',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/wolf.jpg'
      },
      {
        id: 10,
        name: 'Sarah Miller',
        start: '2024-11-17',
        end: '2024-11-18',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg'
      },
      {
        id: 11,
        name: 'Matthew Wilson',
        start: '2024-11-22',
        end: '2024-11-25',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/wolf.jpg'
      },
      {
        id: 12,
        name: 'Grarah Poliller',
        start: '2024-11-23',
        end: '2024-11-24',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg'
      }
    ]
  },
  {
    name: 'Execution',
    children: [
      {
        id: 13,
        name: 'Ashley Taylor',
        start: '2024-11-22',
        end: '2024-11-25',

        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/rabbit.jpg'
      },
      {
        id: 14,
        name: 'Megan',
        start: '2024-11-27',
        end: '2024-11-30',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/cat.jpg'
      },
      {
        id: 15,
        name: 'David',
        start: '2024-12-10',
        end: '2024-12-18',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/flower.jpg'
      }
    ]
  },
  {
    name: 'Monitoring',
    children: [
      {
        id: 16,
        name: 'Hannah',
        start: '2024-11-20',
        end: '2024-11-30',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg'
      },
      {
        id: 17,
        name: 'Andrew',
        start: '2024-12-02',
        end: '2024-12-18',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/wolf.jpg'
      }
    ]
  },
  {
    title: 'Reporting',
    children: [
      {
        id: 18,
        name: 'Joshua Anderson',
        start: '2024-12-22',
        end: '2024-12-28',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/rabbit.jpg'
      }
    ]
  },
  {
    name: 'Process review',
    children: [
      {
        id: 19,
        name: 'Christopher Moore',
        start: '2024-11-25',
        end: '2024-11-30',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/cat.jpg'
      },
      {
        id: 20,
        name: 'Emma',
        start: '2024-12-01',
        end: '2024-12-18',
        avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/flower.jpg'
      }
    ]
  }
];

const columns = [
  {
    field: 'name',
    title: 'PROCESS',
    width: 150,
    tree: true
  }
];
const option = {
  records,
  taskListTable: {
    columns: columns,
    theme: {
      bodyStyle: {
        bgColor: 'white',
        color: 'rgb(115 115 115)'
      },
      headerStyle: {
        color: 'white'
      }
    }
  },
  groupBy: true,
  tasksShowMode: VTableGantt.TYPES.TasksShowMode.Sub_Tasks_Arrange,
  frame: {
    outerFrameStyle: {
      borderLineWidth: 1,
      borderColor: '#e1e4e8',
      cornerRadius: 8
    },
    verticalSplitLineMoveable: false
  },
  grid: {
    horizontalLine: {
      lineWidth: 1,
      lineColor: '#e1e4e8'
    },
    verticalLine: {
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
    labelText: '{name}',
    labelTextStyle: {
      fontFamily: 'Arial',
      fontSize: 14,
      textAlign: 'center',
      color: 'white'
    },
    barStyle: {
      width: 22,
      /** 任务条的颜色 */
      barColor: 'rgb(68 99 244)',
      /** 已完成部分任务条的颜色 */
      completedBarColor: '#91e8e0',
      /** 任务条的圆角 */
      cornerRadius: 15,
      borderColor: 'black',
      borderWidth: 1
    }
  },
  dependency: {
    linkCreatable: true,
    links: [
      {
        type: VTableGantt.TYPES.DependencyType.StartToStart,
        linkedFromTaskKey: 1,
        linkedToTaskKey: 2
      },
      {
        type: VTableGantt.TYPES.DependencyType.FinishToStart,
        linkedFromTaskKey: 2,
        linkedToTaskKey: 3
      },
      {
        type: VTableGantt.TYPES.DependencyType.StartToStart,
        linkedFromTaskKey: 3,
        linkedToTaskKey: 5
      },
      {
        type: VTableGantt.TYPES.DependencyType.FinishToFinish,
        linkedFromTaskKey: 5,
        linkedToTaskKey: 4
      },
      {
        type: VTableGantt.TYPES.DependencyType.StartToStart,
        linkedFromTaskKey: 8,
        linkedToTaskKey: 9
      },
      {
        type: VTableGantt.TYPES.DependencyType.FinishToStart,
        linkedFromTaskKey: 9,
        linkedToTaskKey: 10
      }
    ]
  },
  timelineHeader: {
    verticalLine: {
      lineColor: '#e1e4e8',
      lineWidth: 1
    },
    horizontalLine: {
      lineColor: '#e1e4e8',
      lineWidth: 1
    },
    backgroundColor: '#63a8ff',
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
          color: 'white'
        }
      }
    ]
  },
  minDate: '2024-11-14',
  maxDate: '2024-12-31',
  scrollStyle: {
    scrollRailColor: 'RGBA(246,246,246,0.5)',
    visible: 'none',
    width: 6,
    scrollSliderCornerRadius: 2,
    scrollSliderColor: '#5cb85c'
  }
};
ganttInstance = new VTableGantt.Gantt(document.getElementById(CONTAINER_ID), option);
window['ganttInstance'] = ganttInstance;
```
