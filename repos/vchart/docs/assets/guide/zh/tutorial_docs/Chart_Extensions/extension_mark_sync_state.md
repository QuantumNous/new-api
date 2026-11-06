# ExtensionMark 状态同步插件

当使用 `extensionMark` 在系列上补充绘制自定义图形时，这些图形默认不会跟随主图元（如柱子、点等）的交互状态（hover、select 等）变化。

`ExtensionMarkSyncStatePlugin` 插件可以让配置了 `syncState: true` 的 extensionMark 自动同步主图元的交互状态，使自定义图形在交互时与主图元保持一致的视觉反馈。

## 原理说明

插件会在每次渲染完成后，将 extensionMark 的图形元素与主 mark 的图形元素通过 `context.key`（即数据维度标识）进行配对。当主 mark 的图形元素发生状态变化（如 hover 高亮、blur 虚化、select 选中）时，对应的 extensionMark 图形元素会自动同步相同的状态。

> 注意：仅当扩展图元与主图元绑定同一条 datum（即 `context.key` 相同）时，状态同步才会生效。

## 注册插件

```js
import { registerExtensionMarkSyncStatePlugin } from '@visactor/vchart-extension';

// 在创建 VChart 实例之前注册
registerExtensionMarkSyncStatePlugin();
```

如果使用 CDN 打包的全局变量 `VChartExtension`，请调用 `VChartExtension.registerExtensionMarkSyncStatePlugin()`。

## 使用方式

在 `extensionMark` 的配置项中添加 `syncState: true`，并配置对应的 `state` 样式即可：

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外依赖 @visactor/vchart-extension，包版本保持和vchart一致
// import { registerExtensionMarkSyncStatePlugin } from '@visactor/vchart-extension';
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
const { registerExtensionMarkSyncStatePlugin } = VChartExtension;
/** --在业务中使用时请删除以上代码-- */

registerExtensionMarkSyncStatePlugin();

const data = [
  { category: 'A', value: 80, group: 'February' },
  { category: 'B', value: 120, group: 'February' },
  { category: 'C', value: 60, group: 'February' },
  { category: 'D', value: 150, group: 'February' },
  { category: 'A', value: 90, group: 'March' },
  { category: 'B', value: 100, group: 'March' },
  { category: 'C', value: 110, group: 'March' },
  { category: 'D', value: 70, group: 'March' }
];

const spec = {
  type: 'bar',
  data: [{ id: 'barData', values: data }],
  xField: 'category',
  yField: 'value',
  seriesField: 'group',
  bar: {
    state: {
      highlight: { stroke: '#000', lineWidth: 2 },
      blur: { fillOpacity: 0.2 },
      selected: { stroke: 'red', lineWidth: 3 }
    }
  },
  extensionMark: [
    {
      type: 'symbol',
      dataId: 'barData',
      name: 'topDot',
      syncState: true,
      style: {
        fill: datum => (datum.group === 'February' ? '#1664FF' : '#1AC6FF'),
        symbolType: 'circle',
        size: 12,
        x: (datum, ctx) =>
          ctx.valueToX([datum.category]) + ctx.xBandwidth() / 4 + (datum.group === 'March' ? ctx.xBandwidth() / 2 : 0),
        y: (datum, ctx) => ctx.valueToY([datum.value]) - 15
      },
      state: {
        highlight: { fill: 'orange', size: 20, stroke: '#000', lineWidth: 2 },
        blur: { fillOpacity: 0.15, size: 8 },
        selected: {
          fill: 'red',
          size: 22,
          outerBorder: { distance: 3, lineWidth: 2, stroke: 'red' }
        }
      }
    },
    {
      type: 'text',
      dataId: 'barData',
      name: 'topLabel',
      syncState: true,
      style: {
        text: datum => `${datum.value}`,
        fontSize: 11,
        fill: '#333',
        textAlign: 'center',
        textBaseline: 'bottom',
        x: (datum, ctx) =>
          ctx.valueToX([datum.category]) + ctx.xBandwidth() / 4 + (datum.group === 'March' ? ctx.xBandwidth() / 2 : 0),
        y: (datum, ctx) => ctx.valueToY([datum.value]) - 26
      },
      state: {
        highlight: { fill: 'orange', fontSize: 16, fontWeight: 'bold' },
        blur: { fillOpacity: 0.1 },
        selected: { fill: 'red', fontSize: 14, fontWeight: 'bold' }
      }
    }
  ],
  interaction: {
    hover: { enable: true },
    select: { enable: true }
  },
  legends: { visible: true, orient: 'top' },
  title: {
    visible: true,
    text: 'extensionMark syncState 插件示例',
    subtext: 'Hover / Click bar 查看状态同步效果'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## API

### registerExtensionMarkSyncStatePlugin()

注册 ExtensionMark 状态同步插件。需要在创建 VChart 实例之前调用。

### 配置项

在 `extensionMark` 的每个 mark 配置中，增加以下字段：

| 属性        | 类型      | 默认值  | 说明                     |
| ----------- | --------- | ------- | ------------------------ |
| `syncState` | `boolean` | `false` | 是否同步主图元的交互状态 |

配合 `syncState` 使用时，需在 `state` 中配置对应状态的样式（如 `highlight`、`blur`、`selected`），使状态同步后产生视觉效果。

## 注意事项

1. **数据绑定**：extensionMark 必须配置 `dataId`（或 `dataIndex`），以确保与主 mark 使用相同的数据，`context.key` 才能正确配对
2. **state 样式**：`syncState` 仅同步状态名，不提供默认样式。用户需自行在 `state` 中配置 `highlight`、`blur`、`selected` 等状态样式
3. **group 类型不支持**：`type: 'group'` 的 extensionMark 不支持 `syncState`
