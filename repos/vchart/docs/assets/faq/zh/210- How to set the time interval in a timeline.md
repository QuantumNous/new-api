---
title: 27. 时间轴如何设置时间间隔？</br>
---
## 问题标题

时间轴如何设置时间间隔？</br>


## 问题描述

x轴 type=time时，tick间隔是怎么配置的呢，我希望自定义时间间隔，比如：以“天”为单位间隔</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FkpjbYGbpoxYWqxVjK2ct48Qn2e.gif' alt='' width='3050' height='732'>



## 解决方案 

可以通过配置axes.tickStep来控制时间轴的不同tick间的间隔，注意：tickStep需配置秒时间戳。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TSxibZbcqoEHGMxDGjhcA9q9nlg.gif' alt='' width='3254' height='1472'>



## 代码示例  

```
const spec = {
  color: [
    '#3855df',
    '#ffc52b',
    '#5ecf78',
    '#fb7a00',
    '#0acffd',
    '#217dfd',
    '#98dd61',
    '#3150e0',
    '#714efd',
    '#0bcfff',
    '#3d0dde',
    '#ffc527',
    '#f5c13f',
    '#fb7a08',
    '#95d8fd'
  ],
  type: 'rangeColumn',
  direction: 'horizontal',
  yField: 'type',
  minField: 'start_time',
  maxField: 'end_time',
  seriesField: 'color',
  dataZoom: [
    {
      orient: 'bottom',
      height: 20,
      start: 0.1,
      endValue: 1681956000,
      filterMode: 'axis',
      brushSelect: false,
      startText: {
        formatMethod: text => Math.floor(text)
      },
      endText: {
        formatMethod: text => Math.floor(text)
      }
    }
  ],
  axes: [
    { orient: 'left', type: 'band', bandPadding: 0.5, visible: false },
    {
      type: 'time',
      orient: 'bottom',
      layers: [
        {
          tickStep: 28800,
          timeFormat: '%Y%m%d %H:%M'
        }
      ]
    }
  ],
  title: {
    textStyle: {
      character: [
        {
          text: 'Time-Consuming Distribution',
          fontWeight: 400,
          fill: '#222'
        },
        {
          text: 'Show the SQL distribution of TOP 100',
          fontWeight: 200,
          fontSize: 10,
          fill: '#555'
        }
      ]
    }
  },
  tooltip: {
    visible: true,
    dimension: {
      visible: false
    },
    mark: {
      title: {
        key: 'Query ID',
        value: datum => 'Query ID: ' + datum['id']
      },
      content: [
        {
          key: 'Time Consuming',
          value: datum => datum['useTime']
        },
        {
          key: 'start time',
          value: datum => datum['start_time']
        },
        {
          key: 'end time',
          value: datum => datum['end_time']
        }
      ]
    }
  },
  data: [
    {
      id: 'data0',
      values: [
        {
          start_time: 1681926000,
          end_time: 1681927200,
          type: 'TOP 1',
          color: 'A',
          id: 'a90292870-9282',
          useTime: '100ms'
        },
        {
          start_time: 1681926000,
          end_time: 1681959600,
          type: 'TOP 2',
          color: 'B',
          id: 'a90292870-9282',
          useTime: '100ms'
        },
        {
          start_time: 1681925400,
          end_time: 1681974000,
          type: 'TOP 3',
          color: 'C',
          id: 'a90292870-9282',
          useTime: '100ms'
        },
        {
          start_time: 1681924800,
          end_time: 1681933200,
          type: 'TOP 4',
          color: 'D',
          id: 'a90292870-9282',
          useTime: '100ms'
        },
        {
          start_time: 1681959600,
          end_time: 1681963200,
          type: 'TOP 5',
          color: 'E',
          id: 'a90292870-9282',
          useTime: '100ms'
        },
        {
          start_time: 1681970400,
          end_time: 1681971000,
          type: 'TOP 5',
          color: 'F',
          id: 'a90292870-9282',
          useTime: '100ms'
        },
        {
          start_time: 1681992000,
          end_time: 1681992600,
          type: 'TOP 5',
          color: 'G',
          useTime: '100ms'
        },
        {
          start_time: 1681956000,
          end_time: 1681963200,
          type: 'TOP 6',
          color: 'H',
          id: 'a90292870-9282',
          useTime: '100ms'
        },
        {
          start_time: 1681990200,
          end_time: 1681993800,
          type: 'TOP 7',
          color: 'I',
          id: 'a90292870-9282',
          useTime: '100ms'
        },
        {
          start_time: 1681948800,
          end_time: 1681959600,
          type: 'TOP 8',
          color: 'J',
          id: 'a90292870-9282',
          useTime: '100ms'
        },
        {
          start_time: 1681945200,
          end_time: 1681956000,
          type: 'TOP 9',
          color: 'K',
          id: 'a90292870-9282',
          useTime: '100ms'
        }
      ].reverse()
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

在线效果参考：https://www.visactor.io/vchart/demo/data-zoom/state-with-data</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/B5KFbg8UZohJVfxehv1cgWm7nKh.gif' alt='' width='1576' height='944'>



## 相关文档

时间轴demo：https://www.visactor.io/vchart/demo/data-zoom/state-with-data</br>
坐标轴教程：https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes</br>
相关api：https://www.visactor.io/vchart/option/barChart-axes-time#layers.tickStep</br>
github：https://github.com/VisActor/VChart</br>



