---
category: demo
group: interaction
title: Axis Label Trigger Highlight
keywords: roseChart,comparison,composition,circle
order: 42-7
cover: /vchart/preview/interaction-rose-chart-highlight-by-name_1.9.0.gif
option: roseChart,comparison,composition,circle
---

# Axis Label Trigger Highlight

By configuring the `element-highlight-by-name` interaction type, the axis label triggers the highlight and blur states of the graphic elements.

## Key Configuration

- `interactions` set the interaction of the series
- `rose.state.highlight` set the style corresponding to the `highlight` state of the rose graphic element
- `rose.state.blur` set the style corresponding to the `blur` state of the rose graphic element

## Code Demo

```javascript livedemo
const spec = {
  type: 'rose',
  data: [
    {
      values: [
        {
          time: '12814',
          month: 'Jan',
          level: '0-3',
          location: 'Coastal'
        },
        {
          time: '3054',
          month: 'Jan',
          level: '3-6',
          location: 'Coastal'
        },
        {
          time: '4376',
          month: 'Jan',
          level: '6-9',
          location: 'Coastal'
        },
        {
          time: '4229',
          month: 'Jan',
          level: '9-12',
          location: 'Coastal'
        },

        {
          time: '8814',
          month: 'Feb',
          level: '0-3',
          location: 'Coastal'
        },
        {
          time: '5067',
          month: 'Feb',
          level: '3-6',
          location: 'Coastal'
        },
        {
          time: '13987',
          month: 'Feb',
          level: '6-9',
          location: 'Coastal'
        },
        {
          time: '3932',
          month: 'Feb',
          level: '9-12',
          location: 'Coastal'
        },

        {
          time: '11624',
          month: 'Mar',
          level: '0-3',
          location: 'Coastal'
        },
        {
          time: '7004',
          month: 'Mar',
          level: '3-6',
          location: 'Coastal'
        },
        {
          time: '3574',
          month: 'Mar',
          level: '6-9',
          location: 'Coastal'
        },
        {
          time: '5221',
          month: 'Mar',
          level: '9-12',
          location: 'Coastal'
        },

        {
          time: '8814',
          month: 'Apr',
          level: '0-3',
          location: 'Coastal'
        },
        {
          time: '9054',
          month: 'Apr',
          level: '3-6',
          location: 'Coastal'
        },
        {
          time: '4376',
          month: 'Apr',
          level: '6-9',
          location: 'Coastal'
        },
        {
          time: '5256',
          month: 'Apr',
          level: '9-12',
          location: 'Coastal'
        },

        {
          time: '9998',
          month: 'May',
          level: '0-3',
          location: 'Coastal'
        },
        {
          time: '5043',
          month: 'May',
          level: '3-6',
          location: 'Coastal'
        },
        {
          time: '4572',
          month: 'May',
          level: '6-9',
          location: 'Coastal'
        },
        {
          time: '3308',
          month: 'May',
          level: '9-12',
          location: 'Coastal'
        },

        {
          time: '12321',
          month: 'Jun',
          level: '0-3',
          location: 'Coastal'
        },
        {
          time: '15067',
          month: 'Jun',
          level: '3-6',
          location: 'Coastal'
        },
        {
          time: '3417',
          month: 'Jun',
          level: '6-9',
          location: 'Coastal'
        },
        {
          time: '5432',
          month: 'Jun',
          level: '9-12',
          location: 'Coastal'
        },

        {
          time: '8912',
          month: 'Jan',
          level: '0-3',
          location: 'Inland'
        },
        {
          time: '1753',
          month: 'Jan',
          level: '3-6',
          location: 'Inland'
        },
        {
          time: '1905',
          month: 'Jan',
          level: '6-9',
          location: 'Inland'
        },
        {
          time: '2057',
          month: 'Jan',
          level: '9-12',
          location: 'Inland'
        },

        {
          time: '6987',
          month: 'Feb',
          level: '0-3',
          location: 'Inland'
        },
        {
          time: '1873',
          month: 'Feb',
          level: '3-6',
          location: 'Inland'
        },
        {
          time: '8017',
          month: 'Feb',
          level: '6-9',
          location: 'Inland'
        },
        {
          time: '3056',
          month: 'Feb',
          level: '9-12',
          location: 'Inland'
        },

        {
          time: '8124',
          month: 'Mar',
          level: '0-3',
          location: 'Inland'
        },
        {
          time: '6900',
          month: 'Mar',
          level: '3-6',
          location: 'Inland'
        },
        {
          time: '2768',
          month: 'Mar',
          level: '6-9',
          location: 'Inland'
        },
        {
          time: '1070',
          month: 'Mar',
          level: '9-12',
          location: 'Inland'
        },

        {
          time: '3986',
          month: 'Apr',
          level: '0-3',
          location: 'Inland'
        },
        {
          time: '7986',
          month: 'Apr',
          level: '3-6',
          location: 'Inland'
        },
        {
          time: '1453',
          month: 'Apr',
          level: '6-9',
          location: 'Inland'
        },
        {
          time: '3215',
          month: 'Apr',
          level: '9-12',
          location: 'Inland'
        },

        {
          time: '7905',
          month: 'May',
          level: '0-3',
          location: 'Inland'
        },
        {
          time: '4908',
          month: 'May',
          level: '3-6',
          location: 'Inland'
        },
        {
          time: '1030',
          month: 'May',
          level: '6-9',
          location: 'Inland'
        },
        {
          time: '852',
          month: 'May',
          level: '9-12',
          location: 'Inland'
        },

        {
          time: '3018',
          month: 'Jun',
          level: '0-3',
          location: 'Inland'
        },
        {
          time: '8954',
          month: 'Jun',
          level: '3-6',
          location: 'Inland'
        },
        {
          time: '1395',
          month: 'Jun',
          level: '6-9',
          location: 'Inland'
        },
        {
          time: '3520',
          month: 'Jun',
          level: '9-12',
          location: 'Inland'
        }
      ]
    }
  ],
  categoryField: ['month', 'location'],
  valueField: 'time',
  seriesField: 'level',
  outerRadius: 1,
  title: {
    visible: true,
    text: 'Wind speed statistics for the first half of the year'
  },
  stack: true,
  legends: [{ visible: true, position: 'middle', orient: 'left' }],
  color: ['#FF6D60', '#F7D060', '#F3E99F', '#98D8AA'],
  axes: [
    {
      orient: 'angle',
      domainLine: { visible: true, smooth: true },
      label: { visible: true },
      tick: { visible: true },
      grid: { visible: true, alignWithLabel: false },
      paddingInner: 0.05,
      paddingOuter: 0.1
    },
    {
      orient: 'radius',
      label: { visible: true },
      grid: { visible: true, smooth: true }
    }
  ],

  rose: {
    style: {
      fillOpacity: 0.8
    },
    state: {
      highlight: {
        fillOpacity: 1
      },

      blur: {
        fillOpacity: 0.2
      }
    }
  },

  interactions: [
    {
      type: 'element-highlight-by-name',
      graphicName: ['axis-label'],
      filterField: 'month'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials
