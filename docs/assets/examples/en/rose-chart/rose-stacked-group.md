---
category: examples
group: rose
title: Grouped Stacked Rose Chart
keywords: roseChart,comparison,composition,circle
order: 7-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/rose-chart/rose-stacked-group.png
option: roseChart
---

# Grouped Stacked Rose Chart

When you need to compare data in multiple dimensions under polar coordinates, you can use a grouped stacked rose chart.

## Key option

- The `stack` attribute is used to control whether stacking is enabled, with the default being true
- `categoryField` is used to specify the grouping field in the data
- In `axes`, the `paddingInner` and `paddingOuter` attributes specify the space within and between groups, respectively

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
          level: '0-3',
          location: '沿海'
        },
        {
          time: '3054',
          month: 'Jan',
          level: '3-6',
          location: '沿海'
        },
        {
          time: '4376',
          month: 'Jan',
          level: '6-9',
          location: '沿海'
        },
        {
          time: '4229',
          month: 'Jan',
          level: '9-12',
          location: '沿海'
        },

        {
          time: '8814',
          month: 'Feb',
          level: '0-3',
          location: '沿海'
        },
        {
          time: '5067',
          month: 'Feb',
          level: '3-6',
          location: '沿海'
        },
        {
          time: '13987',
          month: 'Feb',
          level: '6-9',
          location: '沿海'
        },
        {
          time: '3932',
          month: 'Feb',
          level: '9-12',
          location: '沿海'
        },

        {
          time: '11624',
          month: 'Mar',
          level: '0-3',
          location: '沿海'
        },
        {
          time: '7004',
          month: 'Mar',
          level: '3-6',
          location: '沿海'
        },
        {
          time: '3574',
          month: 'Mar',
          level: '6-9',
          location: '沿海'
        },
        {
          time: '5221',
          month: 'Mar',
          level: '9-12',
          location: '沿海'
        },

        {
          time: '8814',
          month: 'Apr',
          level: '0-3',
          location: '沿海'
        },
        {
          time: '9054',
          month: 'Apr',
          level: '3-6',
          location: '沿海'
        },
        {
          time: '4376',
          month: 'Apr',
          level: '6-9',
          location: '沿海'
        },
        {
          time: '5256',
          month: 'Apr',
          level: '9-12',
          location: '沿海'
        },

        {
          time: '9998',
          month: 'May',
          level: '0-3',
          location: '沿海'
        },
        {
          time: '5043',
          month: 'May',
          level: '3-6',
          location: '沿海'
        },
        {
          time: '4572',
          month: 'May',
          level: '6-9',
          location: '沿海'
        },
        {
          time: '3308',
          month: 'May',
          level: '9-12',
          location: '沿海'
        },

        {
          time: '12321',
          month: 'Jun',
          level: '0-3',
          location: '沿海'
        },
        {
          time: '15067',
          month: 'Jun',
          level: '3-6',
          location: '沿海'
        },
        {
          time: '3417',
          month: 'Jun',
          level: '6-9',
          location: '沿海'
        },
        {
          time: '5432',
          month: 'Jun',
          level: '9-12',
          location: '沿海'
        },

        {
          time: '8912',
          month: 'Jan',
          level: '0-3',
          location: '内陆'
        },
        {
          time: '1753',
          month: 'Jan',
          level: '3-6',
          location: '内陆'
        },
        {
          time: '1905',
          month: 'Jan',
          level: '6-9',
          location: '内陆'
        },
        {
          time: '2057',
          month: 'Jan',
          level: '9-12',
          location: '内陆'
        },

        {
          time: '6987',
          month: 'Feb',
          level: '0-3',
          location: '内陆'
        },
        {
          time: '1873',
          month: 'Feb',
          level: '3-6',
          location: '内陆'
        },
        {
          time: '8017',
          month: 'Feb',
          level: '6-9',
          location: '内陆'
        },
        {
          time: '3056',
          month: 'Feb',
          level: '9-12',
          location: '内陆'
        },

        {
          time: '8124',
          month: 'Mar',
          level: '0-3',
          location: '内陆'
        },
        {
          time: '6900',
          month: 'Mar',
          level: '3-6',
          location: '内陆'
        },
        {
          time: '2768',
          month: 'Mar',
          level: '6-9',
          location: '内陆'
        },
        {
          time: '1070',
          month: 'Mar',
          level: '9-12',
          location: '内陆'
        },

        {
          time: '3986',
          month: 'Apr',
          level: '0-3',
          location: '内陆'
        },
        {
          time: '7986',
          month: 'Apr',
          level: '3-6',
          location: '内陆'
        },
        {
          time: '1453',
          month: 'Apr',
          level: '6-9',
          location: '内陆'
        },
        {
          time: '3215',
          month: 'Apr',
          level: '9-12',
          location: '内陆'
        },

        {
          time: '7905',
          month: 'May',
          level: '0-3',
          location: '内陆'
        },
        {
          time: '4908',
          month: 'May',
          level: '3-6',
          location: '内陆'
        },
        {
          time: '1030',
          month: 'May',
          level: '6-9',
          location: '内陆'
        },
        {
          time: '852',
          month: 'May',
          level: '9-12',
          location: '内陆'
        },

        {
          time: '3018',
          month: 'Jun',
          level: '0-3',
          location: '内陆'
        },
        {
          time: '8954',
          month: 'Jun',
          level: '3-6',
          location: '内陆'
        },
        {
          time: '1395',
          month: 'Jun',
          level: '6-9',
          location: '内陆'
        },
        {
          time: '3520',
          month: 'Jun',
          level: '9-12',
          location: '内陆'
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
    text: '上半年风速统计表'
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
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Rose Chart](link)
