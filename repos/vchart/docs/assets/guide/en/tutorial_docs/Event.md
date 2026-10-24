# Events

VChart provides event listening methods on its instances, allowing developers to meet their business needs by listening to events. The events available on VChart include not only basic DOM events but also component interaction events, lifecycle events, etc.

This tutorial will introduce the use of events through two examples. For more detailed information, please refer to the [event API](/vchart/api/API/event).

## How to listen for mouse events on graphic elements

VChart supports regular mouse, pointer, and other event types, all of which are described in the [events API documentation](/vchart/api/API/event).

The following example demonstrates the interaction of opening the corresponding Baidu search page after clicking on a bar in a bar chart by listening for the `click` event on the bar graphic element.

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 处理 bar 图元上点击事件并跳转到相应的百度页面
vchart.on('click', { level: 'mark', type: 'bar' }, e => {
  window.open('https://www.baidu.com/s?wd=' + encodeURIComponent(e.datum.month));
});
```

## How to listen for component interaction events

In VChart, almost all component interaction behaviors will trigger corresponding events. All component interaction events and their parameters are described in the [events API documentation](/vchart/api/API/event).

The example below listens for the `'legendItemHover'` event triggered when the mouse hovers over a legend item:

```ts
vchart.on('legendItemHover', e => {
  const hoveredName = e?.value?.data?.label; // Get the name of the legend item currently being hovered
  if (hoveredName) {
    // Call the `updateState` interface to trigger the custom state 'legend_hover_reverse' of the graphic element
    vchart.updateState({
      legend_hover_reverse: {
        filter: d => d.type !== hoveredName
      }
    });
  }
});
```

## Conclusion

This chapter introduced how to implement chart interactions by listening to different types of events. VChart provides a rich variety of event types and API documentation to help developers better provide a complete visualization experience for end-users. In practice, you can flexibly use the event features provided by VChart to enhance the interaction and expressiveness of charts according to your business needs.
