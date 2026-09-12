---
category: demo
group: tooltip
title: Dimension Tooltip On Time Axis
keywords: tooltip
order: 26-5
cover: /vchart/preview/time-axis-tooltip_1.9.0.png
option: barChart#tooltip
---

# Dimension Tooltip On Time Axis

As a type of continuous axis, the time axis does not support dimension tooltip by default. You can configure `hasDimensionTooltip` to `true` in the spec of the time axis to display the dimension tooltip based on the timeline.

## Demo source

```javascript livedemo
const spec = {
  type: 'rangeColumn',
  data: [
    {
      id: 'data0',
      values: [
        {
          start_time: 1681926000,
          end_time: 1681938200,
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
          start_time: 1681935400,
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
          start_time: 1681950600,
          end_time: 1681963200,
          type: 'TOP 5',
          color: 'E',
          id: 'a90292870-9282',
          useTime: '100ms'
        },
        {
          start_time: 1681970400,
          end_time: 1681981000,
          type: 'TOP 5',
          color: 'F',
          id: 'a90292870-9282',
          useTime: '100ms'
        },
        {
          start_time: 1681990000,
          end_time: 1681999600,
          type: 'TOP 5',
          color: 'G',
          useTime: '100ms'
        },
        {
          start_time: 1681946000,
          end_time: 1681963200,
          type: 'TOP 6',
          color: 'H',
          id: 'a90292870-9282',
          useTime: '100ms'
        },
        {
          start_time: 1681970200,
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
          start_time: 1681935200,
          end_time: 1681956000,
          type: 'TOP 9',
          color: 'K',
          id: 'a90292870-9282',
          useTime: '100ms'
        }
      ]
    }
  ],
  direction: 'horizontal',
  yField: 'type',
  minField: 'start_time',
  maxField: 'end_time',
  seriesField: 'color',
  bar: {
    style: {
      cornerRadius: 100
    }
  },
  axes: [
    { orient: 'left', type: 'band', bandPadding: 0.5 },
    {
      type: 'time',
      orient: 'top',
      layers: [
        {
          tickStep: 28800,
          timeFormat: '%Y%m%d %H:%M'
        }
      ],
      hasDimensionTooltip: true
    }
  ],
  label: {
    visible: true,
    formatMethod: (text, datum) => datum.color
  },
  title: {
    textStyle: {
      character: [
        {
          text: 'Time-Consuming Distribution  ',
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
  crosshair: {
    xField: {
      visible: true
    },
    yField: {
      visible: true
    }
  },
  tooltip: {
    dimension: {
      title: {
        value: (datum, params) => params.dimensionInfo[0].value,
        valueTimeFormat: '%Y%m%d %H:%M'
      },
      content: [
        {
          key: datum => datum.color,
          value: datum => datum.type
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach relevant tutorial or API documentation links associated with this demo configuration.
