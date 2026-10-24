---
category: examples
group: gantt chart
title: cellMerge In Gantt
keywords: ganttChart
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/gantt-table-mergeCell.png
link: '../guide/basic_function/merge_cell'
option: ListTable-columns-text#mergeCell
---

# cellMerge In Gantt

Guid: https://visactor.io/vtable/guide/gantt/Getting_Started.

In Gantt, if the task names are the same, the visual effect of parent tasks containing subtasks can be achieved through cell merging. This can be done by setting the `mergeCell` property in `ListTable#columns`.

## Key Configuration

- `Gantt`
- `VTable#ListTable#Column#mergeCell`

## Code Demo

```javascript livedemo template=vtable
// import * as VTableGantt from '@visactor/vtable-gantt';
// 使用时需要引入插件包@visactor/vtable-editors
// import * as VTable_editors from '@visactor/vtable-editors';
// 正常使用方式 const input_editor = new VTable.editors.InputEditor();
// 官网编辑器中将 VTable.editors重命名成了VTable_editors
const input_editor = new VTable_editors.InputEditor();
const date_input_editor = new VTable_editors.DateInputEditor();
VTableGantt.VTable.register.editor('input', input_editor);
VTableGantt.VTable.register.editor('date-input', date_input_editor);
const barColors0 = ['#aecde6', '#c6a49a', '#ffb582', '#eec1de', '#b3d9b3', '#d9d1a5', '#cccccc', '#e59a9c', '#c9bede'];
const barColors = ['#1f77b4', '#8c564b', '#ff7f0e', '#e377c2', '#2ca02c', '#bcbd22', '#7f7f7f', '#d62728', '#9467bd'];

let ganttInstance;
const records = [
  {
    id: 1,
    name: 'Michael Smith',
    start: '2024-11-15',
    end: '2024-11-17',
    parentTask: 'Planning',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/wolf.jpg'
  },
  {
    id: 2,
    name: 'Emily',
    start: '2024-11-17',
    end: '2024-11-18',
    parentTask: 'Planning',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg'
  },

  {
    id: 3,
    name: 'Rramily',
    start: '2024-11-19',
    end: '2024-11-20',
    parentTask: 'Planning',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg'
  },
  {
    id: 4,
    name: 'Lichael Join',
    start: '2024-11-18',
    end: '2024-11-19',
    parentTask: 'Planning',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/wolf.jpg'
  },

  {
    id: 5,
    name: 'Ryan',
    start: '2024-11-18',
    end: '2024-11-21',
    parentTask: 'Research',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/rabbit.jpg'
  },
  {
    id: 6,
    name: 'Daniel Davis',
    start: '2024-11-21',
    end: '2024-11-22',
    parentTask: 'Goal Setting',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/cat.jpg'
  },
  {
    id: 7,
    name: 'Lauren',
    start: '2024-11-18',
    end: '2024-11-19',
    parentTask: 'Goal Setting',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/flower.jpg'
  },
  {
    id: 8,
    name: 'Tacarah Siller',
    start: '2024-11-20',
    end: '2024-11-21',
    parentTask: 'Strategy',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg'
  },
  {
    id: 9,
    name: 'Camentew Olision',
    start: '2024-11-25',
    end: '2024-11-26',
    parentTask: 'Strategy',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/wolf.jpg'
  },
  {
    id: 10,
    name: 'Sarah Miller',
    start: '2024-11-17',
    end: '2024-11-18',
    parentTask: 'Strategy',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg'
  },
  {
    id: 11,
    name: 'Matthew Wilson',
    start: '2024-11-22',
    end: '2024-11-25',
    parentTask: 'Strategy',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/wolf.jpg'
  },
  {
    id: 12,
    name: 'Grarah Poliller',
    start: '2024-11-23',
    end: '2024-11-24',
    parentTask: 'Strategy',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg'
  },
  {
    id: 13,
    name: 'Ashley Taylor',
    start: '2024-11-22',
    end: '2024-11-25',
    parentTask: 'Execution',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/rabbit.jpg'
  },
  {
    id: 14,
    name: 'Megan',
    start: '2024-11-27',
    end: '2024-11-30',
    parentTask: 'Execution',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/cat.jpg'
  },
  {
    id: 15,
    name: 'David',
    start: '2024-12-10',
    end: '2024-12-18',
    parentTask: 'Execution',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/flower.jpg'
  },
  {
    id: 16,
    name: 'Hannah',
    start: '2024-11-20',
    end: '2024-11-30',
    parentTask: 'Monitoring',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg'
  },
  {
    id: 17,
    name: 'Andrew',
    start: '2024-12-02',
    end: '2024-12-18',
    parentTask: 'Monitoring',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/wolf.jpg'
  },
  {
    id: 18,
    name: 'Joshua Anderson',
    start: '2024-12-22',
    end: '2024-12-28',
    parentTask: 'Reporting',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/rabbit.jpg'
  },
  {
    id: 19,
    name: 'Christopher Moore',
    start: '2024-11-25',
    end: '2024-11-30',
    parentTask: 'Process review',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/cat.jpg'
  },
  {
    id: 20,
    name: 'Emma',
    start: '2024-12-01',
    end: '2024-12-18',
    parentTask: 'Process review',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/flower.jpg'
  }
];

const columns = [
  {
    field: 'parentTask',
    title: 'Task',
    width: 100,
    mergeCell: true,
    editor: 'input',
    style: {
      bgColor: '#EEF1F5',
      color: '#141414',
      fontWeight: 'bold',
      fontSize: 16,
      autoWrapText: true
    }
  },
  {
    field: 'name',
    title: 'Master',
    width: 100,
    editor: 'input'
  },
  {
    field: 'start',
    title: 'start',
    width: 100,
    sort: true,
    editor: 'date-input'
  },
  {
    field: 'end',
    title: 'end',
    width: 100,
    sort: true,
    editor: 'date-input'
  }
];
const option = {
  records,
  taskListTable: {
    columns: columns,
    minTableWidth: 100,
    hierarchyExpandLevel: 5,
    menu: {
      contextMenuItems: ['copy', 'paste', 'delete', '...']
    },
    theme: {
      bodyStyle: {
        padding: 5,
        bgColor: 'white'
      },
      headerStyle: {
        color: 'white'
      }
    }
  },
  groupBy: true,
  tasksShowMode: VTableGantt.TYPES.TasksShowMode.Tasks_Separate,
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
  rowHeight: 60,
  taskBar: {
    startDateField: 'start',
    endDateField: 'end',
    progressField: 'progress',
    labelText: '{name}',
    labelTextStyle: {
      fontFamily: 'Arial',
      fontSize: 16,
      textAlign: 'left'
    },
    barStyle: {
      width: 50,
      /** 任务条的颜色 */
      barColor: '#ee8800',
      /** 已完成部分任务条的颜色 */
      completedBarColor: '#91e8e0',
      /** 任务条的圆角 */
      cornerRadius: 25
    },
    customLayout: args => {
      const colorLength = barColors.length;
      const { width, height, index, startDate, endDate, taskDays, progress, taskRecord, ganttInstance } = args;
      const container = new VTableGantt.VRender.Group({
        width,
        height,
        fill: {
          gradient: 'linear',
          x0: 0,
          y0: 0,
          x1: 1,
          y1: 0,
          stops: [
            {
              offset: 0,
              color: barColors0[index % colorLength]
            },
            {
              offset: 0.5,
              color: barColors[index % colorLength]
            },
            {
              offset: 1,
              color: barColors0[index % colorLength]
            }
          ]
        },
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap'
      });
      const containerLeft = new VTableGantt.VRender.Group({
        height,
        width: 60,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-around'
        // fill: 'red'
      });
      container.add(containerLeft);

      const icon0 = new VTableGantt.VRender.Image({
        width: 40,
        height: 40,
        image: taskRecord.avatar,
        cornerRadius: 20
      });
      containerLeft.add(icon0);

      const containerRight = new VTableGantt.VRender.Group({
        height,
        width: width - 60,
        display: 'flex',
        flexDirection: 'column'
        // alignItems: 'left'
      });
      container.add(containerRight);

      const bloggerName = new VTableGantt.VRender.Text({
        text: taskRecord.name + ' ' + taskRecord.id,
        fontSize: 16,
        fontFamily: 'sans-serif',
        fill: 'white',
        maxLineWidth: width - 60,
        boundsPadding: [10, 0, 0, 0]
      });
      containerRight.add(bloggerName);

      const days = new VTableGantt.VRender.Text({
        text: `${taskDays}天`,
        fontSize: 13,
        fontFamily: 'sans-serif',
        fill: 'white',
        boundsPadding: [10, 0, 0, 0]
      });
      containerRight.add(days);
      return {
        rootContainer: container
      };
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
    colWidth: 100,
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
