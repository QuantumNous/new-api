# Cross-end Instructions

For the various cross-end environments currently on the market (mainly node, various mini-programs, etc.), the underlying rendering engine VRender of VChart has aggregated and smoothed the API differences in each environment. Therefore, at the VChart level, users only need to configure the `mode` parameter when creating a `new VChart` instance to determine which environment to use.

Here is the parameter configuration for the mini-program environment:

```ts
const chartInstance = new VChart(spec, {
  mode: 'miniApp', // mini-program environment
  // Some necessary parameters to pass in this environment
  modeParams: {
    domref, // canvas component instance on the mini-program
    force: true,
    canvasIdLists: [`${this.data.canvasId}_draw_canvas`, `${this.data.canvasId}_tooltip_canvas`], // Pass in the created canvas component id
    tooltipCanvasId: `${this.data.canvasId}_tooltip_canvas`, // The canvas id for drawing tooltip, using canvas tooltip in the mini-program environment
    freeCanvasIdx: 1
  },
  dpr: pixelRatio,
  renderCanvas: `${this.data.canvasId}_draw_canvas`
});
```

## Supported Cross-end Environments

Currently, VChart supports the following cross-end environments and their corresponding parameter configurations:

### node

```ts
new VChart(spec, {
  mode: 'node',
  modeParams: Canvas
});
```

For specific usage, please refer to [Node server-side rendering](../node)

### Byte-based Mini Programs

The mini-program environment currently mainly supports byte-based mini-programs, including: [Feishu Widgets](https://open.feishu.cn/document/client-docs/block/block-introduction), [Feishu Mini Programs](https://www.feishu.cn/hc/zh-CN/articles/027879556391-%E5%BF%AB%E9%80%9F%E5%BC%80%E5%8F%91%E5%B0%8F%E7%A8%8B%E5%BA%8F), [Byte Mini Programs](https://microapp.bytedance.com/) and lynx.

The `mode` value for Feishu Widgets, Feishu Mini Programs and Byte Mini Programs is `miniApp`, and for lynx it is `lynx`. The `modeParams` configuration is consistent.

For specific usage, please refer to the respective tutorials:

- [Feishu Widgets](./block)
- [Feishu Mini Programs](./lark)
- [Byte Mini Programs](./tt)

In addition, other mini-programs, such as WeChat Mini Programs, are also in our compatibility plan and will be available soon.

## Unsupported Chart Features in Mini Programs

Since version `1.6.0`, 3D charts and sequence chart will no longer be supported by default in Feishu widgets, Feishu Mini Programs, ByteDance Mini Programs, and WeChat Mini Programs.
