---
category: examples
group: rose
title: Stacked Rose Chart
keywords: roseChart,comparison,composition,circle
order: 7-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/rose-chart/rose-stacked.png
option: roseChart
---

# Stacked Rose Chart

Similar to the bar chart in the Cartesian coordinate system, the Rose chart supports enabling stacking by setting the `stack` field to true.

## Key Configuration

- The `stack` property is used to control whether to enable stacking, and the default is true
- The `bandPadding` field in `axes` can set the spacing between different groups

## Demo source

```javascript livedemo
const spec = {
  type: 'rose',
  data: [
    {
      values: [
        {
          time: '12814',
          month: 'Jan',
          level: '0-3'
        },
        {
          time: '3054',
          month: 'Jan',
          level: '3-6'
        },
        {
          time: '4376',
          month: 'Jan',
          level: '6-9'
        },
        {
          time: '4229',
          month: 'Jan',
          level: '9-12'
        },

        {
          time: '8814',
          month: 'Feb',
          level: '0-3'
        },
        {
          time: '5067',
          month: 'Feb',
          level: '3-6'
        },
        {
          time: '13987',
          month: 'Feb',
          level: '6-9'
        },
        {
          time: '3932',
          month: 'Feb',
          level: '9-12'
        },

        {
          time: '11624',
          month: 'Mar',
          level: '0-3'
        },
        {
          time: '7004',
          month: 'Mar',
          level: '3-6'
        },
        {
          time: '3574',
          month: 'Mar',
          level: '6-9'
        },
        {
          time: '5221',
          month: 'Mar',
          level: '9-12'
        },

        {
          time: '8814',
          month: 'Apr',
          level: '0-3'
        },
        {
          time: '9054',
          month: 'Apr',
          level: '3-6'
        },
        {
          time: '4376',
          month: 'Apr',
          level: '6-9'
        },
        {
          time: '5256',
          month: 'Apr',
          level: '9-12'
        },

        {
          time: '9998',
          month: 'May',
          level: '0-3'
        },
        {
          time: '5043',
          month: 'May',
          level: '3-6'
        },
        {
          time: '4572',
          month: 'May',
          level: '6-9'
        },
        {
          time: '3308',
          month: 'May',
          level: '9-12'
        },

        {
          time: '12321',
          month: 'Jun',
          level: '0-3'
        },
        {
          time: '15067',
          month: 'Jun',
          level: '3-6'
        },
        {
          time: '3417',
          month: 'Jun',
          level: '6-9'
        },
        {
          time: '5432',
          month: 'Jun',
          level: '9-12'
        }
      ]
    }
  ],
  categoryField: 'month',
  valueField: 'time',
  seriesField: 'level',
  outerRadius: 1,
  stack: true,
  title: {
    visible: true,
    text: '上半年风速统计'
  },
  legends: [{ visible: true, position: 'middle', orient: 'left' }],
  color: ['#FFB84C', '#F266AB', '#A459D1', '#2CD3E1'],
  axes: [
    {
      orient: 'angle',
      domainLine: { visible: true, smooth: true },
      label: { visible: true },
      tick: { visible: true },
      grid: { visible: true },
      bandPadding: 0.05
    },
    {
      orient: 'radius',
      label: { visible: true },
      grid: { visible: true, smooth: true }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Rose Chart](link)
