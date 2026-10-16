---
category: demo
group: data-zoom
title: Define initial range in data form with thumbnail axis
keywords: rangeColumnChart, dataZoom
order: 29-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/data-zoom/state-with-data.png
option: rangeColumnChart#dataZoom
---

# Define initial range in data form with thumbnail axis

Usually, the initial range of the thumbnail axis is represented by a ratio value from 0 to 1. VChart supports defining the initial range in the form of data.

## Key option

- Declare the `startValue` property as the data of the left endpoint of the initial range
- Declare the `endValue` property as the data of the right endpoint of the initial range
- Declare the `start` property as the ratio of the left endpoint of the initial range, range `[0, 1]`
- Declare the `end` property as the ratio of the right endpoint of the initial range, range `[0, 1]`

## Demo source

```javascript livedemo
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
window['vchart'] = vchart;
```

## Related tutorials

Attach links to tutorials or API documentation related to this demo's configuration.
