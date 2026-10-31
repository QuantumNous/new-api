# ExtensionMark SyncState Plugin

When using `extensionMark` to draw custom graphics on a series, these graphics do not follow the interactive states (hover, select, etc.) of the primary marks (bars, dots, etc.) by default.

The `ExtensionMarkSyncStatePlugin` enables extensionMarks configured with `syncState: true` to automatically synchronize the interactive states of the corresponding primary marks, providing consistent visual feedback during interaction.

## How It Works

After each render, the plugin pairs extensionMark graphic elements with primary mark graphic elements via `context.key` (the data dimension identifier). When a primary mark's graphic changes state (e.g., highlight, blur, select), the corresponding extensionMark graphic automatically adopts the same state.

> Note: State synchronization only works when the extension mark and the primary mark are bound to the same datum (i.e., they share the same `context.key`).

## Registration

```js
import { registerExtensionMarkSyncStatePlugin } from '@visactor/vchart-extension';

// Register before creating VChart instances
registerExtensionMarkSyncStatePlugin();
```

When using the CDN global variable `VChartExtension`, call `VChartExtension.registerExtensionMarkSyncStatePlugin()`.

## Usage

Add `syncState: true` to the extensionMark configuration, along with the corresponding `state` styles:

```javascript livedemo
/** --Add the following code when used in business-- */
// When using in a business context, install @visactor/vchart-extension separately (keep version consistent with vchart)
// import { registerExtensionMarkSyncStatePlugin } from '@visactor/vchart-extension';
/** --Add the above code when used in business-- */

/** --Delete the following code when used in business-- */
const { registerExtensionMarkSyncStatePlugin } = VChartExtension;
/** --Delete the above code when used in business-- */

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
    text: 'extensionMark syncState Plugin Demo',
    subtext: 'Hover / Click bars to see state synchronization'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## API

### registerExtensionMarkSyncStatePlugin()

Registers the ExtensionMark SyncState plugin. Must be called before creating VChart instances.

### Configuration

Add the following field to each extensionMark configuration:

| Property    | Type      | Default | Description                                                     |
| ----------- | --------- | ------- | --------------------------------------------------------------- |
| `syncState` | `boolean` | `false` | Whether to synchronize interactive states from the primary mark |

When using `syncState`, configure the corresponding state styles in `state` (e.g., `highlight`, `blur`, `selected`) to produce visual effects on state changes.

## Important Notes

1. **Data binding**: The extensionMark must have `dataId` (or `dataIndex`) configured to share the same data source with the primary mark, ensuring correct `context.key` pairing
2. **State styles**: `syncState` only synchronizes the state name — it does not provide default styles. Configure `highlight`, `blur`, `selected`, etc. in the `state` object
3. **Group type not supported**: `type: 'group'` extensionMarks do not support `syncState`
