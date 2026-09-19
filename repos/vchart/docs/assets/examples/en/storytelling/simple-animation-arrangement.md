---
category: examples
group: storytelling
title: Simple demo for animation arrangement
keywords: animation,bar,pie,barChart,pieChart,comparison
order: 42-0
cover: /vchart/preview/simple-animation-arrangement_1.8.3.gif
option: commonChart#animationAppear
---

# Simple demo for animation arrangement

## Key configuration

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'breakfast', y: 15 },
        { x: 'Monday', type: 'lunch', y: 25 },
        { x: 'Tuesday', type: 'breakfast', y: 12 },
        { x: 'Tuesday', type: 'lunch', y: 30 },
        { x: 'Wednesday', type: 'breakfast', y: 15 },
        { x: 'Wednesday', type: 'lunch', y: 24 },
        { x: 'Thursday', type: 'breakfast', y: 10 },
        { x: 'Thursday', type: 'lunch', y: 25 },
        { x: 'Friday', type: 'breakfast', y: 13 },
        { x: 'Friday', type: 'lunch', y: 20 },
        { x: 'Saturday', type: 'breakfast', y: 10 },
        { x: 'Saturday', type: 'lunch', y: 22 },

        { x: 'Sunday', type: 'breakfast', y: 12 },
        { x: 'Sunday', type: 'lunch', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'drinks', y: 22 },
        { x: 'Tuesday', type: 'drinks', y: 43 },
        { x: 'Wednesday', type: 'drinks', y: 33 },
        { x: 'Thursday', type: 'drinks', y: 22 },
        { x: 'Friday', type: 'drinks', y: 10 },
        { x: 'Saturday', type: 'drinks', y: 30 },
        { x: 'Sunday', type: 'drinks', y: 46 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      xField: ['x', 'type'],
      yField: 'y',
      animationAppear: {
        bar: {
          type: 'moveIn',
          options: { direction: 'x' },
          duration: 1000
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      animationAppear: {
        // 点图元动画配置
        point: {
          type: 'moveIn',
          options: { direction: 'y' },
          easing: 'bounceOut',
          duration: 1000
        },
        // 线图元动画配置
        line: {
          duration: 1500,
          delay: 1000,
          easing: 'cubicOut'
        }
      }
    }
  ],
  axes: [{ orient: 'left' }, { orient: 'bottom', label: { visible: true }, type: 'band' }],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
```

## Related Tutorials

[Scatterplot](link)
