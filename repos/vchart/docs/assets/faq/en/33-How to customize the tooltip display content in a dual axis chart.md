# How to customize the tooltip display content in a dual axis chart?

## Question Description

I am using VChart, as shown in the following figure. How should I hide the information of the bar series in the dimension tooltip and only display the information of the line series?

![tooltip](/vchart/faq/72-0.png)

## Solution

VChart's tooltips can be configured not only at the chart level, but also at the series level. You can turn off the dimension tooltip in the spec of the bar series. As shown in the following demo:

## Code Example

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: '周一', type: '早餐', y: 15 },
        { x: '周一', type: '午餐', y: 25 },
        { x: '周二', type: '早餐', y: 12 },
        { x: '周二', type: '午餐', y: 30 },
        { x: '周三', type: '早餐', y: 15 },
        { x: '周三', type: '午餐', y: 24 },
        { x: '周四', type: '早餐', y: 10 },
        { x: '周四', type: '午餐', y: 25 },
        { x: '周五', type: '早餐', y: 13 },
        { x: '周五', type: '午餐', y: 20 },
        { x: '周六', type: '早餐', y: 10 },
        { x: '周六', type: '午餐', y: 22 },
        { x: '周日', type: '早餐', y: 12 },
        { x: '周日', type: '午餐', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: '周一', type: '饮料', y: 22 },
        { x: '周二', type: '饮料', y: 43 },
        { x: '周三', type: '饮料', y: 33 },
        { x: '周四', type: '饮料', y: 22 },
        { x: '周五', type: '饮料', y: 10 },
        { x: '周六', type: '饮料', y: 30 },
        { x: '周日', type: '饮料', y: 50 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataIndex: 0,
      label: { visible: true },
      seriesField: 'type',
      xField: ['x', 'type'],
      yField: 'y',
      tooltip: {
        dimension: {
          visible: false
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: 0 },
    { orient: 'right', seriesIndex: 1 },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Result

![demo](/vchart/faq/72-1.png)

## Quote

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)

option docs: [https://www.visactor.io/vchart/option/barChart#tooltip.dimension.visible](https://www.visactor.io/vchart/option/barChart#tooltip.dimension.visible)
