---
category: examples
group: bar chart
title: Bar Chart with Bar Background
keywords: barChart,comparison,distribution,rectangle,composition,rank
cover: /vchart/preview/bar-background_1.6.0.png
option: barChart
---

# Bar Chart with Bar Background

Bar charts can set the background mark `barBackground` for each bar mark.

## Key Configuration

- Set the x-axis mapping field and **grouping field** on the `xField` property.
- The `seriesField` property declares the color mapping field.
- The `stack` property is declared as true for configuring stacking, which will be stacked according to the fields declared in the `seriesField` property.
- In the `axes` property, enable the `domainLine.onZero` configuration for the axis line located at the `bottom` position, and adjust the axis line to the vertical axis value 0.
- The `barBackground` property is the setting of the background mark, and the setting items are the same as `bar`. Background marks are not displayed by default.

## Demo source

```javascript livedemo
const response = await fetch('https://www.unpkg.com/@visactor/vchart-theme@latest/public/vScreenVolcanoBlue.json');
const theme = await response.json();
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          date: '2019-08-29',
          group: 'A',
          value: 154,
          stack: 'Dessert'
        },
        {
          date: '2019-08-29',
          group: 'B',
          value: 378,
          stack: 'Dessert'
        },
        {
          date: '2019-08-29',
          group: 'A',
          value: 103,
          stack: 'Drink'
        },
        {
          date: '2019-08-29',
          group: 'B',
          value: 310,
          stack: 'Drink'
        },
        {
          date: '2019-08-30',
          group: 'A',
          value: 153,
          stack: 'Dessert'
        },
        {
          date: '2019-08-30',
          group: 'B',
          value: 398,
          stack: 'Dessert'
        },
        {
          date: '2019-08-30',
          group: 'A',
          value: 105,
          stack: 'Drink'
        },
        {
          date: '2019-08-30',
          group: 'B',
          value: 298,
          stack: 'Drink'
        },
        {
          date: '2019-08-31',
          group: 'A',
          value: 151,
          stack: 'Dessert'
        },
        {
          date: '2019-08-31',
          group: 'B',
          value: 408,
          stack: 'Dessert'
        },
        {
          date: '2019-08-31',
          group: 'A',
          value: 110,
          stack: 'Drink'
        },
        {
          date: '2019-08-31',
          group: 'B',
          value: 302,
          stack: 'Drink'
        }
      ]
    }
  ],
  xField: ['date', 'stack', 'group'],
  yField: 'value',
  seriesField: 'group',
  stack: true,
  barBackground: {
    visible: true,
    fieldLevel: 0,
    style: {
      lineWidth: 0,
      fill: 'rgba(255,255,255,0.15)'
    }
  },
  axes: [
    {
      orient: 'left',
      title: {
        visible: true,
        text: 'Week-on-week (sales)'
      },
      tick: {
        tickCount: 10
      }
    },
    {
      orient: 'top',
      showAllGroupLayers: true
    }
  ],
  tooltip: {
    dimension: {
      content: [
        {
          key: datum => `${datum.stack}-${datum.group}`,
          value: datum => datum.value
        }
      ]
    }
  },
  animation: false,
  theme
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

let ptr = 0;
const specList = [
  {
    barBackground: {
      fieldLevel: 0,
      style: {
        lineWidth: 0
      }
    }
  },
  {
    barBackground: {
      fieldLevel: 1,
      style: {
        lineWidth: 0
      }
    }
  },
  {
    barBackground: {
      fieldLevel: 2,
      style: {
        lineWidth: 0
      }
    }
  },
  {
    barBackground: {
      fieldLevel: 2,
      style: {
        lineWidth: 2,
        stroke: null
      }
    }
  }
];
const timer = setInterval(() => {
  vchart?.updateSpec(specList[++ptr % specList.length], true);
}, 1500);

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Key Configuration

## Related Tutorials

[Bar Chart](link)
