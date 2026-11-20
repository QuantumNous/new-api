---
title: 27. How to set the time interval in the timeline?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to set time intervals on the timeline?</br>


## Description

When the x-axis type = time, how is the tick interval configured? I want to customize the time interval, for example: interval in "days".</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/EKcabJ4aCokjgvxlt0rcbFiWnad.gif' alt='' width='3050' height='732'>



## Solution

You can control the interval between different ticks in the timeline by configuring axes.tickStep. Note: tickStep needs to be configured with a second timestamp.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OjoFbuyJZoigDWxDTV4cLrL7nab.gif' alt='' width='3254' height='1472'>

## Code Example

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
## Results

Online demo：https://www.visactor.io/vchart/demo/data-zoom/state-with-data</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/G4OMbeqfqobRKox22R0cT0OWnuf.gif' alt='' width='1576' height='944'>



## Related Documentation

Time Axes Demo：https://www.visactor.io/vchart/demo/data-zoom/state-with-data</br>
Time Axes Tutorial：https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes</br>
Related Api：https://www.visactor.io/vchart/option/barChart-axes-time#layers.tickStep</br>
github：https://github.com/VisActor/VChart</br>



