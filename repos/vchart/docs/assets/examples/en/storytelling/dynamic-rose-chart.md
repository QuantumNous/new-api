---
category: examples
group: storytelling
title: Dynamic Rose Chart
keywords: roseChart,comparison,composition,animation
order: 36-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/storytelling/dynamic-rose-chart.gif
option: roseChart
---

# Dynamic Rose Chart

## Key option

- `data.fields` attribute configures specific information of data fields
  - `[field].domain` attribute configures the value range and order of the `month` data field
  - `[field].lockStatisticDomain` attribute configures whether `[field].domain` affects the chart's data statistical results;
- `data.id` attribute configures the data id, used for data updates and indexing;
- `updateData(dataId: StringOrNumber, data: DataView | Datum[])` interface accepts two parameters, data id and new data, new data supports arrays and `DataView` format;

## Demo source

```javascript livedemo
const monthData = {
  January: [
    { type: 'rail', value: 31.8, month: 'January' },
    { type: 'highway', value: 39.2, month: 'January' },
    { type: 'civil aviation', value: 24.1, month: 'January' }
  ],
  February: [
    { type: 'rail', value: 46.4, month: 'February' },
    { type: 'highway', value: 38, month: 'February' },
    { type: 'civil aviation', value: 22.3, month: 'February' }
  ],
  March: [
    { type: 'rail', value: 30.3, month: 'March' },
    { type: 'highway', value: 30.9, month: 'March' },
    { type: 'civil aviation', value: 23.4, month: 'March' }
  ],
  April: [
    { type: 'rail', value: 60.8, month: 'April' },
    { type: 'highway', value: 26.8, month: 'April' },
    { type: 'civil aviation', value: 24.5, month: 'April' }
  ],
  May: [
    { type: 'rail', value: 31.7, month: 'May' },
    { type: 'highway', value: 26.4, month: 'May' },
    { type: 'civil aviation', value: 27, month: 'May' }
  ],
  June: [
    { type: 'rail', value: 38.7, month: 'June' },
    { type: 'highway', value: 36.7, month: 'June' },
    { type: 'civil aviation', value: 33.4, month: 'June' }
  ],
  July: [
    { type: 'rail', value: 25.3, month: 'July' },
    { type: 'highway', value: 34.7, month: 'July' },
    { type: 'civil aviation', value: 28.2, month: 'July' }
  ],
  August: [
    { type: 'rail', value: 45.3, month: 'August' },
    { type: 'highway', value: 25.3, month: 'August' },
    { type: 'civil aviation', value: 30.8, month: 'August' }
  ],
  September: [
    { type: 'rail', value: 26.8, month: 'September' },
    { type: 'highway', value: 29.4, month: 'September' },
    { type: 'civil aviation', value: 20.9, month: 'September' }
  ],
  October: [
    { type: 'rail', value: 39.8, month: 'October' },
    { type: 'highway', value: 38.5, month: 'October' },
    { type: 'civil aviation', value: 39, month: 'October' }
  ],
  November: [
    { type: 'rail', value: 38.3, month: 'November' },
    { type: 'highway', value: 23.8, month: 'November' },
    { type: 'civil aviation', value: 29.4, month: 'November' }
  ],
  December: [
    { type: 'rail', value: 62.8, month: 'December' },
    { type: 'highway', value: 35.8, month: 'December' },
    { type: 'civil aviation', value: 35.2, month: 'December' }
  ]
};
let curIndex = 0;
const month = Object.keys(monthData);
const data = monthData[month[curIndex]];
const spec = {
  type: 'rose',
  data: [
    {
      id: 'id0',
      values: data,
      fields: {
        month: {
          lockStatisticsByDomain: true,
          domain: [
            'January',
            'February',
            'March',
            'April',
            'May',
            'June',
            'July',
            'August',
            'September',
            'October',
            'November',
            'December'
          ]
        }
      }
    }
  ],
  padding: {
    top: 30
  },
  radius: 0.8,
  innerRadius: 0,
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type',
  stack: true,
  rose: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  animationAppear: {
    rose: {
      duration: 500,
      easing: 'bounceOut'
    }
  },
  animationEnter: {
    rose: {
      type: 'growRadiusIn',
      options: { overall: true },
      duration: 500,
      easing: 'bounceOut'
    }
  },
  legends: {
    visible: true,
    orient: 'top',
    interactive: false
  },
  axes: [
    {
      orient: 'radius',
      visible: true,
      tick: { tickCount: 3 },
      grid: { visible: true, style: { lineDash: [0] } },
      max: 150
    },
    {
      orient: 'angle',
      visible: true,
      domainLine: { visible: true, smooth: false },
      grid: { visible: true, smooth: false },
      label: {
        visible: true,
        style: {
          fill: '#000'
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
for (let i = 1; i < month.length; i++) {
  setTimeout(() => {
    curIndex++;
    const newData = monthData[month[curIndex]];
    data.push(...newData);
    vchart.updateData('id0', data);
  }, i * 1000);
}

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorial

[Bar Chart](link)
