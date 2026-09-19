# 跨端说明

针对目前市面上的各种跨端环境（主要是 node，各种小程序等），VChart 的底层渲染引擎 VRender 对各个环境上的 API 差异做了收拢抹平，所以在 VChart 这一层，用户只需要在 `new VChart` 实例的时候，配置 `mode` 参数来确定使用哪一种环境即可。

如下为小程序环境的参数配置：

```ts
const chartInstance = new VChart(spec, {
  mode: 'miniApp', // 小程序环境
  // 该环境下必要传入的一些参数
  modeParams: {
    domref, // 小程序上的 canvas 组件实例
    force: true,
    canvasIdLists: [`${this.data.canvasId}_draw_canvas`, `${this.data.canvasId}_tooltip_canvas`], // 传入创建的 canvas 组件 id
    tooltipCanvasId: `${this.data.canvasId}_tooltip_canvas`, // 用于绘制 tooltip 的 canvas id，小程序环境使用 canvas tooltip
    freeCanvasIdx: 1
  },
  dpr: pixelRatio,
  renderCanvas: `${this.data.canvasId}_draw_canvas`
});
```

## 支持的跨端环境

目前 VChart 支持的跨端环境以及对应的参数配置如下：

### node

```ts
new VChart(spec, {
  mode: 'node',
  modeParams: Canvas
});
```

具体使用详见[Node 服务端渲染](../node)

### 字节系小程序

小程序环境目前主要支持了字节系的小程序，包括：[飞书小组件](https://open.feishu.cn/document/client-docs/block/block-introduction)，[飞书小程序](https://www.feishu.cn/hc/zh-CN/articles/027879556391-%E5%BF%AB%E9%80%9F%E5%BC%80%E5%8F%91%E5%B0%8F%E7%A8%8B%E5%BA%8F)，[字节小程序](https://microapp.bytedance.com/) 以及 lynx。

飞书小组件、飞书小程序以及字节小程序对应的 `mode` 值为 `miniApp`，lynx 为 `lynx`，`modeParams` 配置一致。

具体的使用详见各自的教程：

- [飞书小组件](./block)
- [飞书小程序](./lark)
- [字节小程序](./tt)

另外其他的小程序，如微信小程序，也在我们的兼容计划中，很快就会提供。

## 小程序不支持的图表特性

自 `1.6.0` 版本后，飞书小组件、飞书小程、字节小程序和微信小程序中，默认情况下将不再支持 3D 图表、时序图。
