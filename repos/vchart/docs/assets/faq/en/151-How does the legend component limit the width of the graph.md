# How does the legend component limit the width of the graph?

## Question Description

Use VChart. When the legend text is relatively long, it is expected to limit the width of the legend items to prevent the legend from taking up too much space and causing this kind of paging.

## Solution

VChart's legend component provides the configuration of the maximum width of the legend item. You can configure the desired value. When the legend item exceeds this maximum value, the text will be omitted, and a prompt message will appear when the mouse hovers over it.

```ts
legends: [
  {
    type: 'discrete',
    item: {
      maxWidth: 200
    }
  }
];
```

## Code Example

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'Number of users who closed the video in the first 10 seconds', time: '2:00', value: 129 },
        { type: 'Number of users who closed the video in the first 10 seconds', time: '6:00', value: 133 },
        { type: 'Number of users who watched the video for more than 10 seconds', time: '2:00', value: 22 },
        { type: 'Number of users who watched the video for more than 10 seconds', time: '6:00', value: 13 }
      ]
    }
  ],
  xField: ['time', 'type'],
  yField: 'value',
  seriesField: 'type',
  legends: {
    visible: true,
    orient: 'top',
    position: 'start',
    item: {
      maxWidth: 200
    },
    maxRow: 1
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [legends configuration](https://www.visactor.io/vchart/option/barChart#legends-discrete.item.maxWidth)
