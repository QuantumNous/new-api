---
title: 20. Does the primitive shape support SVG?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

Does the graphic shape in the chart support custom SVG?</br>
## Description

How to customize the start and end icons in datazoom? Tried the configurable items in dataZoom.startHandler.style symbolType and didn't find what I needed</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/UjNabX2gsonUhBxus1Xc4Pjjnsb.gif' alt='' width='996' height='180'>

## Solution 

Configure symbolType in the primitive style. The shape type of symbol supports passing in built-in types, and can also be set to a custom path string and svg image. The same configuration can be done for any symbol type primitive in VChart.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Tt2lbHrqFoc3Alxu16ycNDFHnff.gif' alt='' width='3254' height='1498'>

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
      },
      startHandler: {
        style: {
          dy: -12,
          dx: -8,
          symbolType: '<svg t="1714125379383" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="20427" width="200" height="200"><path d="M827.505255 195.268312C652.829957 20.593014 369.558335 20.593014 194.883037 195.269335 20.202623 369.94975 20.201599 653.220349 194.876897 827.895647c174.681438 174.681438 457.952037 174.679391 632.632451 0C1002.18567 653.220349 1002.18567 369.94975 827.505255 195.268312zM352.449679 703.530175l-63.700811 0L288.748868 319.832306l63.700811 0L352.449679 703.530175zM543.467177 703.530175l-63.700811 0L479.766366 319.832306l63.700811 0L543.467177 703.530175zM735.848743 703.530175l-63.700811 0L672.147932 319.832306l63.700811 0L735.848743 703.530175z" fill="#272636" p-id="20428"></path></svg>'
        }
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

Online demo：https://codesandbox.io/p/sandbox/svg-symbol-8k9tdz?file=%2Fsrc%2Findex.ts%3A208%2C29</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WY3rbaQqbobdJTx4ZAlcM5npnbb.gif' alt='' width='1492' height='1062'>

## Related Documentation

DataZoom Demo: https://visactor.bytedance.net/vchart/demo/data-zoom/state-with-data</br>
Related Api：https://visactor.io/vchart/option/lineChart#dataZoom.startHandler.style.symbolType</br>
github：https://github.com/VisActor/VChart</br>



