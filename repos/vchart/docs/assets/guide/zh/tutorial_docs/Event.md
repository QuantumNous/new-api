# 事件

VChart 实例上提供了事件监听相关的方法，开发者可以通过监听事件来满足业务需求。VChart 上提供的事件除了基础的 dom 事件外，还包含了组件交互事件、生命周期事件等。

本教程将通过两个示例介绍事件的使用，更多详细信息请查阅[事件 API](/vchart/api/API/event)。

## 如何监听图元上的鼠标事件

VChart 支持常规的鼠标、指针等事件类型，支持的所有事件在 [events API 文档](/vchart/api/API/event)中均有描述。

下面的示例通过监听柱图上 bar 图元的 `click` 事件现了点击柱子后打开相应的百度搜索页面的交互。

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

## 如何监听组件交互事件

在 VChart 中，几乎所有的组件交互行为都会触发相应的事件。所有的组件交互事件及其参数在 [events API 文档](/vchart/api/API/event) 中均有描述。

如下是一个监听鼠标 hover 到图例项时触发的 `'legendItemHover'` 事件：

```ts
vchart.on('legendItemHover', e => {
  const hoveredName = e?.value?.data?.label; // 获取当前被 hover 的图例项名称
  if (hoveredName) {
    // 调用 `updateState` 接口来触发图元的自定义状态 'legend_hover_reverse'
    vchart.updateState({
      legend_hover_reverse: {
        filter: d => d.type !== hoveredName
      }
    });
  }
});
```

## 总结

本章介绍了如何通过监听不同类型事件来实现图表交互。VChart 提供了丰富的事件类型和 API 文档，帮助开发者更好地为最终用户提供完善的可视化体验。在实际应用中，你可以根据业务需灵活地使用 VChart 提供的事件功能来增强图表的交互和表达力。
