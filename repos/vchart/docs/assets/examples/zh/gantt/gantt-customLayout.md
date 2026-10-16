---
category: examples
group: gantt chart
title: 甘特图自定义渲染用法
keywords: ganttChart
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/gantt-customLayout-preview.png
link: '../guide/gantt/gantt_customLayout'
option: Gantt#taskBar
---

# 甘特图自定义渲染用法

甘特图介绍：https://visactor.io/vtable/guide/gantt/Getting_Started。

该示例展示了如何自定义渲染甘特图任务条及日期表头。左侧任务信息表格的自定义渲染，是定义在 columns 中的 customLayout 实现的，可参考[教程](../../option/ListTable-columns-text#customLayout)。

在本示例中，任务条的自定义渲染，是定义在 taskBar 中的 customLayout 实现的；日期表头的自定义渲染，是定义在 timelineHeader 中的 customLayout 实现的。可参考[教程](../../guide/gantt/gantt_customLayout)。

## 关键配置

- `VTable`
- `Gantt`
- `taskBar`
- `timelineHeader`

## 代码演示

```javascript livedemo template=vtable
// import * as VTableGantt from '@visactor/vtable-gantt';
// import * as VRender from '@visactor/vtable/es/vrender';
let ganttInstance;
const barColors0 = ['#aecde6', '#c6a49a', '#ffb582', '#eec1de', '#b3d9b3', '#cccccc', '#e59a9c', '#d9d1a5', '#c9bede'];
const barColors = ['#1f77b4', '#8c564b', '#ff7f0e', '#e377c2', '#2ca02c', '#7f7f7f', '#d62728', '#bcbd22', '#9467bd'];
const records = [
  {
    id: 1,
    title: 'Project Task 1',
    developer: 'bear.xiong',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bear.jpg',
    start: '2024-07-24',
    end: '2024-07-26',
    progress: 31,
    priority: 'P0'
  },
  {
    id: 2,
    title: 'Project Task 2',
    developer: 'wolf.lang',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/wolf.jpg',
    start: '07/25/2024',
    end: '07/28/2024',
    progress: 60,
    priority: 'P0'
  },
  {
    id: 3,
    title: 'Project Task 3',
    developer: 'rabbit.tu',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/rabbit.jpg',
    start: '2024-07-28',
    end: '2024-08-01',
    progress: 100,
    priority: 'P1'
  },
  {
    id: 1,
    title: 'Project Task 4',
    developer: 'cat.mao',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/cat.jpg',
    start: '2024-07-31',
    end: '2024-08-03',
    progress: 31,
    priority: 'P0'
  },
  {
    id: 2,
    title: 'Project Task 5',
    developer: 'bird.niao',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/bird.jpeg',
    start: '2024-08-02',
    end: '2024-08-04',
    progress: 60,
    priority: 'P0'
  },
  {
    id: 3,
    title: 'Project Task 6',
    developer: 'flower.hua',
    avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/flower.jpg',
    start: '2024-08-03',
    end: '2024-08-10',
    progress: 100,
    priority: 'P1'
  }
];
const columns = [
  {
    field: 'title',
    title: 'TASK',
    width: '200',
    headerStyle: {
      textAlign: 'center',
      fontSize: 20,
      fontWeight: 'bold',
      color: 'black',
      bgColor: '#f0f0fb'
    },
    style: {
      bgColor: '#f0f0fb'
    },
    customLayout: args => {
      const { table, row, col, rect } = args;
      const taskRecord = table.getCellOriginRecord(col, row);
      const { height, width } = rect ?? table.getCellRect(col, row);
      const container = new VTableGantt.VRender.Group({
        y: 10,
        x: 20,
        height: height - 20,
        width: width - 40,
        fill: 'white',
        display: 'flex',
        flexDirection: 'column',
        cornerRadius: 30
      });

      const developer = new VTableGantt.VRender.Text({
        text: taskRecord.developer,
        fontSize: 16,
        fontFamily: 'sans-serif',
        fill: barColors[args.row],
        fontWeight: 'bold',
        maxLineWidth: width - 120,
        boundsPadding: [10, 0, 0, 0],
        alignSelf: 'center'
      });
      container.add(developer);

      const days = new VTableGantt.VRender.Text({
        text: `${VTableGantt.tools.formatDate(new Date(taskRecord.start), 'mm/dd')}-${VTableGantt.tools.formatDate(
          new Date(taskRecord.end),
          'mm/dd'
        )}`,
        fontSize: 12,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        fill: 'black',
        boundsPadding: [10, 0, 0, 0],
        alignSelf: 'center'
      });
      container.add(days);

      return {
        rootContainer: container,
        expectedWidth: 160
      };
    }
  }
];
const option = {
  records,
  taskListTable: {
    columns,
    tableWidth: 'auto',
    theme: {
      headerStyle: {
        borderColor: '#e1e4e8',
        borderLineWidth: 0,
        fontSize: 18,
        fontWeight: 'bold',
        color: 'red'
        // bgColor: '#EEF1F5'
      },
      bodyStyle: {
        borderColor: '#e1e4e8',
        borderLineWidth: 0,
        fontSize: 16,
        color: '#4D4D4D',
        bgColor: '#FFF'
      }
    }
  },
  frame: {
    outerFrameStyle: {
      borderLineWidth: 0,
      borderColor: 'red',
      cornerRadius: 8
    }
    // verticalSplitLineHighlight: {
    //   lineColor: 'green',
    //   lineWidth: 3
    // }
  },
  grid: {
    backgroundColor: '#f0f0fb',
    // vertical: {
    //   lineWidth: 1,
    //   lineColor: '#e1e4e8'
    // },
    horizontalLine: {
      lineWidth: 2,
      lineColor: '#d5d9ee'
    }
  },
  headerRowHeight: 60,
  rowHeight: 80,
  taskBar: {
    startDateField: 'start',
    endDateField: 'end',
    progressField: 'progress',
    barStyle: { width: 60 },
    customLayout: args => {
      const colorLength = barColors.length;
      const { width, height, index, startDate, endDate, taskDays, progress, taskRecord, ganttInstance } = args;
      const container = new VTableGantt.VRender.Group({
        width,
        height,
        cornerRadius: 30,
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

      const avatar = new VTableGantt.VRender.Image({
        width: 50,
        height: 50,
        image: taskRecord.avatar,
        cornerRadius: 25
      });
      containerLeft.add(avatar);
      const containerCenter = new VTableGantt.VRender.Group({
        height,
        width: width - (width >= 120 ? 120 : 60),
        display: 'flex',
        flexDirection: 'column'
        // alignItems: 'left'
      });
      container.add(containerCenter);

      const developer = new VTableGantt.VRender.Text({
        text: taskRecord.developer,
        fontSize: 16,
        fontFamily: 'sans-serif',
        fill: 'white',
        fontWeight: 'bold',
        maxLineWidth: width - (width >= 120 ? 120 : 60),
        boundsPadding: [10, 0, 0, 0]
      });
      containerCenter.add(developer);

      const days = new VTableGantt.VRender.Text({
        text: `${taskDays}天`,
        fontSize: 13,
        fontFamily: 'sans-serif',
        fill: 'white',
        boundsPadding: [10, 0, 0, 0]
      });
      containerCenter.add(days);

      if (width >= 120) {
        const containerRight = new VTableGantt.VRender.Group({
          cornerRadius: 20,
          fill: 'white',
          height: 40,
          width: 40,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center', // 垂直方向居中对齐
          boundsPadding: [10, 0, 0, 0]
        });
        container.add(containerRight);

        const progressText = new VTableGantt.VRender.Text({
          text: `${progress}%`,
          fontSize: 12,
          fontFamily: 'sans-serif',
          fill: 'black',
          alignSelf: 'center',
          fontWeight: 'bold',
          maxLineWidth: (width - 60) / 2,
          boundsPadding: [0, 0, 0, 0]
        });
        containerRight.add(progressText);
      }
      return {
        rootContainer: container
        // renderDefaultBar: true
        // renderDefaultText: true
      };
    },
    hoverBarStyle: {
      cornerRadius: 30
    }
  },
  timelineHeader: {
    backgroundColor: '#f0f0fb',
    colWidth: 80,
    // verticalLine: {
    //   lineColor: 'red',
    //   lineWidth: 1,
    //   lineDash: [4, 2]
    // },
    // horizontalLine: {
    //   lineColor: 'green',
    //   lineWidth: 1,
    //   lineDash: [4, 2]
    // },
    scales: [
      {
        unit: 'day',
        step: 1,
        format(date) {
          return date.dateIndex.toString();
        },
        customLayout: args => {
          const colorLength = barColors.length;
          const { width, height, index, startDate, endDate, days, dateIndex, title, ganttInstance } = args;
          const container = new VTableGantt.VRender.Group({
            width,
            height,
            fill: '#f0f0fb',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap'
          });
          const containerLeft = new VTableGantt.VRender.Group({
            height,
            width: 30,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-around'
            // fill: 'red'
          });
          container.add(containerLeft);

          const avatar = new VTableGantt.VRender.Image({
            width: 20,
            height: 30,
            image:
              '<svg t="1724675965803" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4299" width="200" height="200"><path d="M53.085678 141.319468C23.790257 141.319468 0 165.035326 0 194.34775L0 918.084273C0 947.295126 23.796789 971.112572 53.085678 971.112572L970.914322 971.112572C1000.209743 971.112572 1024 947.396696 1024 918.084273L1024 194.34775C1024 165.136896 1000.203211 141.319468 970.914322 141.319468L776.827586 141.319468 812.137931 176.629813 812.137931 88.275862C812.137931 68.774506 796.328942 52.965517 776.827586 52.965517 757.32623 52.965517 741.517241 68.774506 741.517241 88.275862L741.517241 176.629813 741.517241 211.940158 776.827586 211.940158 970.914322 211.940158C961.186763 211.940158 953.37931 204.125926 953.37931 194.34775L953.37931 918.084273C953.37931 908.344373 961.25643 900.491882 970.914322 900.491882L53.085678 900.491882C62.813237 900.491882 70.62069 908.306097 70.62069 918.084273L70.62069 194.34775C70.62069 204.087649 62.74357 211.940158 53.085678 211.940158L247.172414 211.940158C266.67377 211.940158 282.482759 196.131169 282.482759 176.629813 282.482759 157.128439 266.67377 141.319468 247.172414 141.319468L53.085678 141.319468ZM211.862069 176.629813C211.862069 196.131169 227.671058 211.940158 247.172414 211.940158 266.67377 211.940158 282.482759 196.131169 282.482759 176.629813L282.482759 88.275862C282.482759 68.774506 266.67377 52.965517 247.172414 52.965517 227.671058 52.965517 211.862069 68.774506 211.862069 88.275862L211.862069 176.629813ZM1024 353.181537 1024 317.871192 988.689655 317.871192 35.310345 317.871192 0 317.871192 0 353.181537 0 441.457399C0 460.958755 15.808989 476.767744 35.310345 476.767744 54.811701 476.767744 70.62069 460.958755 70.62069 441.457399L70.62069 353.181537 35.310345 388.491882 988.689655 388.491882 953.37931 353.181537 953.37931 441.457399C953.37931 460.958755 969.188299 476.767744 988.689655 476.767744 1008.191011 476.767744 1024 460.958755 1024 441.457399L1024 353.181537ZM776.937913 582.62069C796.439287 582.62069 812.248258 566.811701 812.248258 547.310345 812.248258 527.808989 796.439287 512 776.937913 512L247.172414 512C227.671058 512 211.862069 527.808989 211.862069 547.310345 211.862069 566.811701 227.671058 582.62069 247.172414 582.62069L776.937913 582.62069ZM247.172414 688.551724C227.671058 688.551724 211.862069 704.360713 211.862069 723.862069 211.862069 743.363425 227.671058 759.172414 247.172414 759.172414L600.386189 759.172414C619.887563 759.172414 635.696534 743.363425 635.696534 723.862069 635.696534 704.360713 619.887563 688.551724 600.386189 688.551724L247.172414 688.551724ZM776.827586 211.940158 741.517241 176.629813 741.517241 247.328574C741.517241 266.829948 757.32623 282.638919 776.827586 282.638919 796.328942 282.638919 812.137931 266.829948 812.137931 247.328574L812.137931 176.629813 812.137931 141.319468 776.827586 141.319468 247.172414 141.319468C227.671058 141.319468 211.862069 157.128439 211.862069 176.629813 211.862069 196.131169 227.671058 211.940158 247.172414 211.940158L776.827586 211.940158ZM282.482759 176.629813C282.482759 157.128439 266.67377 141.319468 247.172414 141.319468 227.671058 141.319468 211.862069 157.128439 211.862069 176.629813L211.862069 247.328574C211.862069 266.829948 227.671058 282.638919 247.172414 282.638919 266.67377 282.638919 282.482759 266.829948 282.482759 247.328574L282.482759 176.629813Z" fill="#389BFF" p-id="4300"></path></svg>'
          });
          containerLeft.add(avatar);

          const containerCenter = new VTableGantt.VRender.Group({
            height,
            width: width - 30,
            display: 'flex',
            flexDirection: 'column'
            // alignItems: 'left'
          });
          container.add(containerCenter);
          const dayNumber = new VTableGantt.VRender.Text({
            text: String(dateIndex).padStart(2, '0'),
            fontSize: 20,
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
            fill: 'black',
            textAlign: 'right',
            maxLineWidth: width - 30,
            boundsPadding: [15, 0, 0, 0]
          });
          containerCenter.add(dayNumber);

          const weekDay = new VTableGantt.VRender.Text({
            text: VTableGantt.tools.getWeekday(startDate, 'short').toLocaleUpperCase(),
            fontSize: 12,
            fontFamily: 'sans-serif',
            fill: 'black',
            boundsPadding: [0, 0, 0, 0]
          });
          containerCenter.add(weekDay);
          return {
            rootContainer: container
            //renderDefaultText: true
          };
        }
      }
    ]
  },
  minDate: '2024-07-20',
  maxDate: '2024-08-15',
  markLine: [
    {
      date: '2024-07-29',
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
  scrollStyle: {
    scrollRailColor: 'RGBA(246,246,246,0.5)',
    visible: 'focus',
    width: 6,
    scrollSliderCornerRadius: 2,
    scrollSliderColor: '#5cb85c'
  }
};
ganttInstance = new VTableGantt.Gantt(document.getElementById(CONTAINER_ID), option);
window['ganttInstance'] = ganttInstance;
```
