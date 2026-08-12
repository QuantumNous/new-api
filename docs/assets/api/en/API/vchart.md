# VChart

global `VChart` Objects, which also serve as the general entry point for charts, are used for chart creation, update, and destruction.

## static properties

### ThemeManager

Theme manager. It can be used to register, set up and obtain deng for global Themes, see[Theme](./theme).

### globalConfig

Global configuration items for VChart. The properties in this object can be directly modified, and the time when the configuration takes effect depends on the specific configuration item.

#### uniqueTooltip(number) = true

Whether to globally display unique tooltips. If set to true, when a chart triggers a tooltip, the tooltips of all other charts on the same page will automatically disappear.

This configuration modification takes effect immediately.

## static method

### useRegisters

```ts
  /**
   * Register charts and components on demand
   * @param comps
   * @since 1.5.1
   */
  static useRegisters(comps: (() => void)[]) {
    comps.forEach((fn: () => void) => {
      fn();
    });
  }

```

API is supported since version `1.5.1`.
It is used to load charts, series, components, environment-compatible codes, etc. on demand. For details, please refer to the [On-demand Import Tutorial](../../../guide/en/tutorial_docs/Basic/How_to_Import_VChart.md).

### useChart

```ts
/**
 * Register custom charts
 * @param charts chart class
 */
useChart: (charts: IChartConstructor[]) => void;
```

Used to register custom charts for extensions.

### useSeries

```ts
/**
 * register custom series
 * @param series series class
 */
useSeries: (series: ISeriesConstructor[]) => void;
```

Used to register custom series for extensions.

### useComponent

```ts
/**
 * register custom component
 * @param components components class
 */
useComponent: (components: IComponentConstructor[]) => void;
```

Used to register custom component for extensions.

### useMark

```ts
/**
 * register custom mark
 * @param marks Mark class
 */
useMark: (marks: MarkConstructor[]) => void;
```

Used to register custom mark for extensions.

### useLayout

```ts
/**
 * register custom layout
 * @param layouts layout class
 */
useLayout: (layouts: ILayoutConstructor[]) => void;
```

Used to register custom layout for extensions.

### registerDataSetTransform

```ts
  /**
   * register DataSet transform function
   * @param name data transform function name
   * @param transform specific Transform function
   */
  registerDataSetTransform: (name: string, transform: Transform) => void;
```

Used to register DataSet data methods.

### registerMap

```ts
/**
 * register map data
 * @param key map data name
 * @param source map data
 * @param option map data config
 */
registerMap: (key: string, source: GeoSourceType, option?: GeoSourceOption) => void;
```

Used to register map data.

```ts
export type GeoSourceOption = IGeoJsonOption | ITopoJsonOption;

export interface GeoSourceOption {
  type: 'geojson';
  /** Calculate center point */
  /** @default true */
  centroid?: boolean;
  /** Map simplification */
  /** @default false */
  simplify?:
    | boolean
    | {
        /**
         * A number in degrees(e.g. lat/lon distance).
         * 1 degree is roughly equivalent to 69 miles. the default is 0.001, which is around a city block long.
         * @default 0.01
         * @since 1.11.0
         */
        tolerance: number;
      };
  /** Reverse winding of outer rings of (Multi)LineString or (Multi)Polygon, and clockwise for inner rings. */
  /** @default false */
  rewind?:
    | boolean
    | {
        /** Enable reverse winding */
        /** @default false */
        reverse?: boolean;
      };
}

/** topojson */
export interface ITopoJsonOption extends Omit<IGeoJsonOption, 'type'> {
  type: 'topojson';
  object: string;
}
```

### unregisterMap

```ts
/**
 * unregister map data
 * @param key map data name
 */
unregisterMap: (key: string) => void;
```

Used to unload map data.

### getMap

```ts
/**
 * get map data from data name
 * @param key map data name
 * @returns map data
 */
getMap: (key: string) => GeoSourceType;
```

Obtain the corresponding map data according to the registered map name.

## Initialization (new VChart)

```ts
new VChart(spec: ISpec, options: IInitOption);
```

Used to create VChart instances.

### Parameter description

#### spec

For the spec configuration of the chart, see[configuration item](../../option/)Page.

#### Options

Chart configuration, including rendering containers, etc., see the following table for details:

| Attribute Name          | Type                        | Required | Description                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | --------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dom`                   | `string\|HTMLElement`       | No       | **Valid only in browser environments.** The parent container of the chart mount, you can directly specify the container id, or you can pass in the dom object                                                                                                                                                                                                                |
| `renderCanvas`          | `string\|HTMLCanvasElement` | No       | In addition to selecting the dom property to mount the parent container, you can also use the renderCanvas property to directly pass in the canvas instance/canvasId, for the Mini Program/widget environment, please pass in the id directly                                                                                                                                |
| `dataSet`               | `DataSet`                   | No       | Dataset                                                                                                                                                                                                                                                                                                                                                                      |
| `autoFit`               | `boolean`                   | No       | Whether to adapt to container size, default is `true`                                                                                                                                                                                                                                                                                                                        |
| `animation`             | `boolean`                   | No       | Whether to turn on animation, the default is `true`                                                                                                                                                                                                                                                                                                                          |
| `options3d`             | `srIOption3DType`           | No       | 3d Configuration                                                                                                                                                                                                                                                                                                                                                             |
| `layout`                | `LayoutCallBack`            | No       | Custom layout function                                                                                                                                                                                                                                                                                                                                                       |
| `mode`                  | `string`                    | No       | Configure the rendering environment, the default is'desktop-browser ', when you need to render VChart in a non-browser environment, you need to configure this property. `'desktop-browser'`: Default mode, suitable for PC and H5; `'mobile-browser'`: H5 mode; `'node'`: Node rendering; `'worker'`: worker mode; `'miniApp'`: Mini Program Mode; `'lynx'`: lynx rendering |
| `modeParams`            | any                         | No       | configuration `mode` Parameters are used together for configuration `mode` Some special configurations of the environment corresponding to the parameters                                                                                                                                                                                                                    |
| `dpr`                   | `number`                    | No       | Set screen definition                                                                                                                                                                                                                                                                                                                                                        |
| `interactive`           | `boolean`                   | No       | Chart interaction global switch, default is `true`.                                                                                                                                                                                                                                                                                                                          |
| `viewBox`               | `object`                    | No       | Specifies the rectangular Region to draw, such as `{ x1: 100, y1: 100, x2: 300, y2: 300 }`                                                                                                                                                                                                                                                                                   |
| `canvasControled`       | `boolean`                   | No       | Used to tell the underlying rendering engine VRender whether the Canvas of the chart is a controlled canvas, and if not, no operations such as resize will be performed.                                                                                                                                                                                                     |
| `stage`                 | `Stage`                     | No       | External incoming VRender stage                                                                                                                                                                                                                                                                                                                                              |
| `layer`                 | `Layer`                     | No       | External incoming VRender layer                                                                                                                                                                                                                                                                                                                                              |
| `beforeRender`          | `Function`                  | No       | Draw the previous hook function,`(stage: IStage) => void`                                                                                                                                                                                                                                                                                                                    |
| `afterRender`           | `Function`                  | No       | The hook function after drawing,`(stage: IStage) => void`                                                                                                                                                                                                                                                                                                                    |
| `background`            | `string\object`             | No       | Drawing Region background color setting, you can configure gradual change color                                                                                                                                                                                                                                                                                              |
| `logLevel`              | `number`                    | No       | Log type for development and debugging                                                                                                                                                                                                                                                                                                                                       |
| `disableDirtyBounds`    | `boolean`                   | No       | Whether to close dirtyBounds                                                                                                                                                                                                                                                                                                                                                 |
| `enableView3dTransform` | `boolean`                   | No       | Whether to enable the transformation mode of view3d                                                                                                                                                                                                                                                                                                                          |
| `poptip`                | `boolean`                   | No       | Whether to enable poptip for omitting text, used to view the complete text content, enabled by default                                                                                                                                                                                                                                                                       |
| `resizeDelay`           | `number`                    | No       | The interval duration in milliseconds for triggering a resize when automatically responding to container resize events; supported from `1.12.5`.                                                                                                                                                                                                                             |
| `gestureConfig`         | `GestureConfig`             | No       | Gesture event configuration; when configured as non-empty, gesture-related events are enabled.                                                                                                                                                                                                                                                                               |
| `autoRefreshDpr`        | `boolean`                   | Yes      | Whether to automatically refresh the dpr when switching screens and the dpr changes; if the dpr is not explicitly set, this feature is enabled by default; supported from version `1.12.14`.                                                                                                                                                                                 |

- The `srIOption3DType` type is defined as follows:

```ts
export interface srIOption3DType extends IOption3D {
  enable?: boolean;
  enableView3dTransform?: boolean;
}
export interface IOption3D {
  alpha?: number;
  beta?: number;
  gama?: number;
  center?: IPointLike;
  fieldRatio?: number;
  fieldDepth?: number;
  light?: {
    dir?: vec3;
    color?: string;
    ambient?: number;
  };
  camera?: any;
}
```

The `LayoutCallBack` type is defined as follows:

```ts
export type LayoutCallBack = (
  chart: IChart,
  item: ILayoutItem[],
  chartLayoutRect: IRect,
  chartViewBox: IBoundsLike
) => void;
```

- The `GestureConfig` type is defined as follows:

```ts
export interface GestureConfig {
  press?: {
    /**
     * @default 251
     * Minimal press time in ms.
     */
    time?: number;
    /**
     * @default 10
     * Maximal movement that is allowed while pressing.
     */
    threshold?: number;
  };
  swipe?: {
    /**
     * Minimal distance required before recognizing.
     * @default 10
     */
    threshold?: number;
    /**
     * Minimal velocity required before recognizing, unit is in px per ms.
     * @default 0.3
     */
    velocity?: number;
  };
  tap?: {
    /**
     * max time between the multi-tap taps
     * @default 300
     */
    interval?: number;
  };
}
```

### example

```ts
import VChart from '@visactor/vchart';

const spec = {
  // chart spec
};
// create an instance of VChart
const chart = new VChart(spec, {
  dom: 'chart' // the id of chart container
});
```

## attribute

### ID

Read-only property, id of VChart instance, internally generated.

## method

### renderSync

**synchronization**Render the chart.

```ts
/**
 * **SYNC** Renders the chart.
 * @param morphConfig chart morph animation configuration, optional
 * @returns VChart instance
 */
renderSync: (morphConfig?: IMorphConfig) => IVChart;
```

### renderAsync

Not recommended for use after version 1.9.0, asynchronous rendering/asynchronous update related APIs will be deprecated in the future.

**asynchronous**Render the chart.

```ts
/**
 * **Asynchronously** render the chart.
 * @async
 * @param morphConfig chart morph animation configuration, optional
 * @returns VChart instance
 */
renderAsync: (morphConfig?: IMorphConfig) => Promise<IVChart>;
```

### updateData

**asynchronous**Update data. parameter `id` Corresponds in spec `data` attribute `id` Field, the chart will be automatically rendered without calling `renderAsync()` And other rendering methods.

```ts
/**
 * **Asynchronous** update data.
 * @param id data id
 * @param data data value
 * @param options data parameters
 * @returns VChart instance
 */
updateData: (id: StringOrNumber, data: DataView | Datum[] | string, options?: IParserOptions) => Promise<IVChart>;
```

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'pie',
      values: [
        { type: '1', value: 100 },
        { type: '2', value: 200 },
        { type: '3', value: 300 }
      ]
    }
  ],
  categoryField: 'type',
  valueField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

setTimeout(() => {
  vchart.updateData('pie', [
    { type: '1', value: 200 },
    { type: '2', value: 200 },
    { type: '3', value: 100 }
  ]);
}, 2000);
```

### updateDataInBatches

**asynchronous**Batch update data, the chart will be automatically rendered without calling `renderAsync()` And other rendering methods.

```ts
/**
 * **Asynchronous** Batch update data.
 * @param list data list to be updated
 * @returns VChart instance
 */
updateDataInBatches: (list: { id: string; data: DataView | Datum[]; options?: IParserOptions }[]) => Promise<IVChart>;
```

### updateDataSync

**synchronization**Update data. parameter `id` Corresponds in spec `data` attribute `id` Field, the chart will be automatically rendered without calling `renderAsync()` And other rendering methods.

```ts
/**
 * **Sync** updates data.
 * @param id data id
 * @param data data value
 * @param options data parameters
 * @returns VChart instance
 */
updateDataSync: (id: StringOrNumber, data: DataView | Datum[], options?: IParserOptions) => IVChart;
```

### updateFullData

Update data interface. The parameter is a complete data item configuration. You can update the `fields` configuration of the data through this interface. By default, the chart will be automatically rendered without calling rendering methods such as `renderAsync()`.

```ts
/**
 * update data
 * @param data
 * @param reRender
 * @returns VChart instance
 * @since 1.3.0
 */
updateFullData: (data: IDataValues | IDataValues[], reRender: boolean = true) => IVChart;
```

### updateFullDataSync

**Sync** Update data interface. The parameter is a complete data item configuration. You can update the `fields` configuration of the data through this interface. By default, the chart will be automatically rendered without calling rendering methods such as `renderAsync()`.

```ts
/**
 * **Sync** update data
 * @param data
 * @param reRender
 * @returns VChart instance
 * @since 1.3.0
 */
updateFullDataSync: (data: IDataValues | IDataValues[], reRender: boolean = true) => IVChart;
```

### updateSpec

**asynchronous**The spec update will automatically render the chart without calling it again `renderAsync()` And other rendering methods.

```ts
/**
 * spec update
 * @param spec
 * @param forceMerge Whether to force merge, the default is false
 * @param morphConfig morph animation configuration
 * @returns
 */
updateSpec: (spec: ISpec, forceMerge?: boolean, morphConfig?: IMorphConfig) => Promise<IVChart>;
```

### updateModelSpec

**asynchronous** module spec update, you can specify to update the configuration of a chart module through filter, and the chart will be automatically rendered without calling rendering methods such as `renderAsync()`.

```ts
/**
 * model spec update
 * @param filter
 * @param spec
 * @param forceMerge
 * @returns
 * @sync 1.4.0
 */
updateModelSpec: (
  filter: string | { type: string; index: number },
  spec: unknown,
  forceMerge?: boolean,
  morphConfig?: IMorphConfig
) => Promise<IVChart>;
```

### updateViewBox

Update the drawing Region. viewBox is the drawing Region in the format `{ x1: number; x2: number; y1: number; y2: number }`.

```ts
/**
 * Update the drawing area.
 * @param viewBox drawing area
 * @param reRender Whether to re-render, the default is true
 * @returns
 */
updateViewBox: (viewBox: IBoundsLike, reRender?: boolean) => IVChart;
```

### Resize

**asynchronous method**, the chart size update method.

```ts
/**
 * **Asynchronous method**, chart size update method.
 * @param width width
 * @param height height
 * @returns VChart current instance
 */
resize: (width: number, height: number) => Promise<IVChart>;
```

### Release

Destroy the chart.

```ts
  /**
   * release chart
   */
  release: () => void;
```

### On

```ts
on(event: string, callback: (params: EventParams) => void): void;
on(event: string, query: EventQuery, callback: (params: EventParams) => void): void;
```

Event binding. For more specific use, please move to[Event](./event).

### Off

```ts
off(event: string, callback: (params: EventParams) => void): void;
```

Event unloading.

### updateState

Update or set the primitive state.

```ts
  /**
   * Update or set the primitive state.
   * @param state state filter
   * @param filter filter
   */
  updateState: (
    state: Record<string, Omit<IMarkStateSpec<unknown>, 'style'>>,
    filter?: (series: ISeries, mark: IMark, stateKey: string) => boolean //series + mark 筛选
  ) => void;
```

The following example shows how to update the state filter when we click on a point in the graph, with this point `type` Points with different values become translucent, using an example:

```ts
const spec = {
  type: 'scatter',
  data: [
    {
      id: 'data1',
      values: [
        { x: 1, y: 80, type: 'a' },
        { x: 2, y: 10, type: 'a' },
        { x: 1, y: 10, type: 'b' },
        { x: 2, y: 20, type: 'b' }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  point: {
    state: {
      // Set the properties corresponding to the state first
      custom_unSelected: {
        fillOpacity: 0.5
      }
    }
  }
};

const vchart = new VChart(spec);
vchart.renderSync();
// listen to click event
vchart.on('click', { level: 'mark' }, ctx => {
  vchart.updateState({
    // The name should correspond to the above configuration
    custom_unSelected: {
      filter: datum => {
        // The data type does not want to wait to enter this state
        return datum.type !== ctx.datum.type;
      }
    }
  });
});
```

### setSelected

Update primitive selection status.

```ts
  /**
   * Update the selected state of the primitive.
   * @param datum hover metadata data
   * @param filter filter used to filter series and mark
   * @param region region filter
   */
  setSelected: (
    datum: MaybeArray<any> | null,
    filter?: (series: ISeries, mark: IMark) => boolean,
    region?: IRegionQuerier
  ) => void;
```

Set a set of data to the selected state, or you can directly set null to unselect the state.

```ts
/**
 * Assume that the chart data is as follows
   [
    {x: 'US' , y: 10, type: 'A'}
    {x: 'NZ' , y: 20, type: 'A'}
    {x: 'US' , y: 30, type: 'B'}
    {x: 'NZ' , y: 40, type: 'B'}
   ]
 */
// select data with type === 'A'
vchart.setSelected({ type: 'A' });
// selected data {x: 'US' , y: 10, type: 'A'}
vchart.setSelected({ x: 'US', y: 10, type: 'A' });
// cancel the current selected data
vchart.setSelected(null);
```

### setHovered

Update primitive hover status.

```ts
  /**
   * Update primitive hover state
   * @param datum hover metadata data
   * @param filter filter used to filter series and mark
   * @param region region filter
   */
  setHovered: (
    datum: MaybeArray<Datum> | null,
    filter?: (series: ISeries, mark: IMark) => boolean,
    region?: IRegionQuerier
  ) => void;
```

Set a data to `hover` Status, you can also directly set null to cancel `hover` Status.

`setHovered` Similar effect `setSelected`, supports setting multiple pieces of data to `hover` Status.

```ts
/**
 * Assume that the chart data is as follows
   [
    {x: 'US' , y: 10, type: 'A'}
    {x: 'NZ' , y: 20, type: 'A'}
    {x: 'US' , y: 30, type: 'B'}
    {x: 'NZ' , y: 40, type: 'B'}
   ]
 */
// select data with type === 'A'
vchart.setHovered({ type: 'A' });
// selected data {x: 'US' , y: 10, type: 'A'}
vchart.setHovered({ x: 'US', y: 10, type: 'A' });
// cancel the current selected data
vchart.setHovered(null);
```

### clearState

Clear the state of the marks

```ts
 /**
   * clear the state of marks
   * @param state name of state
   *
   * @since 1.11.0
   */
  clearState: (state: string) => void;
```

### clearAllStates

Clear all states of the marks

```ts
 /**
   * clear all states of marks
   *
   * @since 1.12.4
   */
  clearAllStates: (state: string) => void;
```

### clearSelected

clear the `selected` state of marks

```ts
/**
   * clear the `selected` state of marks
   *
   * @since 1.11.0
   */
  clearSelected: () => void;
```

### clearHovered

clear the `hovered` state of marks

```ts
/**
   * clear the `hovered` state of marks
   *
   * @since 1.11.0
   */
  clearHovered: () => void;
```

### getCurrentTheme

Getting the current Theme will return the full Theme configuration.

```ts
getCurrentTheme: () => ITheme;
```

### getCurrentThemeName

Get the current Theme name (only get user pass `setCurrentTheme` Theme set by the method, the default value is `ThemeManager` Theme with unified settings).

```ts
getCurrentThemeName: () => string;
```

### setCurrentTheme

**Asynchronous method**, set the current Theme.

**Note: If the `theme` property is configured in the chart spec, the `spec.theme` has higher priority.**

```ts
/**
 * **Asynchronous method**, set the current theme.
 * @param name theme name
 * @returns
 */
setCurrentTheme: (name: string) => Promise<IVChart>;
```

Usage example:

```javascript livedemo
// Define custom theme
const customTheme = {
  colorScheme: {
    default: [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#FFA07A',
      '#98D8C8',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1E2'
    ]
  },
  series: {
    bar: {
      barMaxWidth: 20,
      label: {
        visible: true,
        position: 'top'
      }
    }
  }
};

// Register theme
VChart.ThemeManager.registerTheme('myCustomTheme', customTheme);

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', value: 120 },
        { type: 'B', value: 200 },
        { type: 'C', value: 150 },
        { type: 'D', value: 80 }
      ]
    }
  ],
  xField: 'type',
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Set theme through instance method
vchart.setCurrentTheme('myCustomTheme');
```

**Note**:
- Before using the `setCurrentTheme` method, you need to register the theme first through `VChart.ThemeManager.registerTheme()`
- This method is asynchronous and returns a Promise, you can use `await` or `.then()` to handle it
- If the `theme` property is configured in the chart spec, the theme in the spec has higher priority

### setTooltipHandler

When the configuration item cannot meet the display needs of the tooltip, we also provide the ability to customize the tooltip. You can configure `TooltipHandler` To override the default tooltip presentation logic.

```ts
/**
   * Custom TooltipHandler.
   * @param tooltipHandler
   */
  setTooltipHandler: (tooltipHandler: ITooltipHandler) => void;
```

Note:

- When customizing the chart is set`TooltipHandler`After that, the built-in tooltip will no longer work.
- VChart does not perceive or host custom tooltip rendering. Please implement tooltip rendering by yourself as needed, including**Processing original data sources**,**Tooltip content design**, and**Create components and style them according to the project environment**.
- The current is called when the chart is deleted`TooltipHandler`of`release`Function, please delete as needed.
- Due to custom`TooltipHandler`Overrides the built-in tooltip logic,**chart`spec`Some tooltip configuration items in**But the following configuration items apply to all customizations`TooltipHandler`See also:
  - `tooltip.visible` //TODO: Add tooltip spec link, currently tooltip does not have a special configuration item page
  - `tooltip.activeType`
  - `tooltip.trigger`
  - `tooltip.triggerOff`

`ITooltipHandler`The interface is defined as follows:

```ts
interface ITooltipHandler {
  /** Display tooltip, you can choose to return whether an exception is encountered */
  showTooltip: (
    activeType: TooltipActiveType,
    data: TooltipData,
    params: TooltipHandlerParams
  ) => TooltipResult | null | undefined;

  /** hide tooltip */
  hideTooltip: (params: TooltipHandlerParams) => void;

  /** release tooltip */
  release: () => void;
}
```

among them`ITooltipHandler.showTooltip`There are three parameters, the meanings are:

- `activeType`: reveal the tooltip type triggered this time, the value is`'mark'`or`'dimension'`
- `data`: reveal the tooltip original data source triggered this time
- `params`: reveal the mouse event of the tooltip triggered this time

`data`The type of the parameter is`TooltipData`, the type is defined as:

```ts
type TooltipData = IDimensionInfo[] | IDimensionData[];
```

If the user triggers the mark tooltip,`TooltipData` just for `IDimensionData[]` Type.`IDimensionData`The type is defined as:

```ts
interface IDimensionData {
  /** The original data on the primitive (considering the situation of multiple primitives, it is actually an array type) */
  datum: Datum[];
  /** The series instance where the primitive is located */
  series: ISeries;
}
```

And if the user triggers the dimension tooltip,`TooltipData` just for `IDimensionInfo[]` Type.`IDimensionInfo`Carrying the information of the entire Dimension item where the mouse is located, the type is defined as:

```ts
interface IDimensionInfo {
  /** dimension item index */
  index?: number;
  /** Dimension item title */
  value: string;
  /** The axis of the dimension item */
  axis?: AxisComponent;
  /** Dimension item corresponding data */
  data: IDimensionData[];
}
```

Users can choose to use`ITooltipHandler.showTooltip`Method returns a state`TooltipResult`, used to indicate whether the tooltip is successfully displayed (if not returned, it will be regarded as successful by default). This return value is related to the caching policy.`TooltipResult`Is an enumeration type, defined as:

```ts
enum TooltipResult {
  /** tooltip shows success */
  success = 0,
  /** tooltip failed to display */
  failed = 1
}
```

`ITooltipHandler.showTooltip`The last parameter of the method is`params`, whose type is defined as:

```ts
type TooltipHandlerParams = (BaseEventParams | DimensionEventParams) & {
  changePositionOnly?: boolean;
};
```

It exposes a very useful parameter:`changePositionOnly`,**Indicates whether this tooltip is just that the previous tooltip has misappropriated the lower position, and the data is the same**This parameter will help users optimize tooltip rendering

Example: Type the dimension item title and series mark fill where the user's mouse hovers.

```ts
vchart.setTooltipHandler({
  showTooltip: (activeType, data, params) => {
    if (params.changePositionOnly) {
      return;
    }
    if (activeType === 'dimension' && data?.length) {
      console.log(data[0].value);
    } else if (activeType === 'mark') {
      const { datum, series } = data[0];
      const color = series.getSeriesStyle(datum[0])('fill');
      console.log(color);
    }
  }
});
```

### getTooltipHandler

obtain`TooltipHandler`.

```ts
getTooltipHandler: () => ITooltipHandler | undefined;
```

### showTooltip

Manually invoke the display tooltip.

```ts
/**
 * Manually call the display tooltip
 * @param datum raw data
 * @param options
 * @returns
 */
showTooltip: (datum: Datum, options: IShowTooltipOption) => boolean;

interface IRegionQuerier {
  regionId?: StringOrNumber;
  regionIndex?: number;
}

interface IShowTooltipOption extends IRegionQuerier {
  /* Tooltip expected display x coordinate (if it is empty, it is near the primitive) */
  x?: number;
  /* The y coordinate expected to be displayed by the tooltip (if it is empty, it is near the primitive) */
  y?: number;
  /* Whether it is often displayed (if it is false or empty, after the tooltip is manually triggered, the tooltip may be replaced by another tooltip that is automatically triggered) */
  alwaysShow?: boolean;
  /* tooltip type (automatically judge if it is empty) */
  activeType?: TooltipActiveType;
}
```

### hideTooltip

Call manually, close tooltip

```ts
hideTooltip: () => boolean;
```

### getLegendDataById

Get the legend data according to the legend component id, which comes from the spec `legends` Configured in the field `id`Such as: `legends: { id: 'bottom' }` or `legends: [{ id: 'left' }]`

```ts
  /**
   * Get the legend data according to the legend component id
   * @param id component id
   * @returns
   */
  getLegendDataById: (id: string) => StringOrNumber[];
```

Legend data type：

```ts
type LegendDatum = {
  key: string; // legend item group
  shapeType?: string; // legend symbol shape
  style?: (channel: string) => any; // Legend style function, receives the visual channel name and returns the visual channel style, e.g. 'fill'
};
```

### getLegendDataByIndex

Get legend data according to the legend component index.

```ts
  /**
   * Get the legend data according to the legend component index
   * @param index Legend index, default is 0
   * @returns
   */
  getLegendDataByIndex: (index?: number) => StringOrNumber[];
```

Legend data type：

```ts
type LegendDatum = {
  key: string; // legend item group
  shapeType?: string; // legend symbol shape
  style?: (channel: string) => any; // Legend style function, receives the visual channel name and returns the visual channel style, e.g. 'fill'
};
```

### getLegendSelectedDataById

Get the selected item of the current legend according to the legend component id, which comes from the spec `legends` Configured in the field `id`Such as: `legends: { id: 'bottom' }` or `legends: [{ id: 'left' }]`

```ts
  /**
   * Get the selected item of the current legend according to the legend component id
   * @param id component id
   * @returns
   */
  getLegendSelectedDataById: (id: string) => StringOrNumber[];
```

### getLegendSelectedDataByIndex

Gets the selected item of the current legend according to the legend component index.

```ts
  /**
   * Get the selected item of the current legend according to the legend component index
   * @param index Legend index, default is 0
   * @returns
   */
  getLegendSelectedDataByIndex: (index?: number) => StringOrNumber[];

```

### setLegendSelectedDataById

Update the legend selection data according to the legend component id from the spec `legends` Configured in the field `id`Such as: `legends: { id: 'bottom' }` or `legends: [{ id: 'left' }]`

```ts
  /**
   * Update the legend selected data according to the legend component id
   * @param id
   * @returns
   */
  setLegendSelectedDataById: (id: string, selectedData: StringOrNumber[]) => void;
```

### setLegendSelectedDataByIndex

Update the legend selection data according to the legend component index.

```ts
  /**
   * Update the legend selected data according to the legend component index
   * @param index Legend index, default is 0
   * @returns
   */
  setLegendSelectedDataByIndex: (index: number, selectedData: StringOrNumber[]) => void;
```

### getDataURL

**asynchronous method**Returns a data URI that contains the image display.

```ts
getDataURL: () => Promise<any>;
```

### exportImg

**asynchronous method** Export chart images, only support browser side, and parameters at the same time `name` Pictures can be named.

```ts
/**
 * **Asynchronous method** Export chart pictures, only supports browser side.
 * @param name the saved image name
 * @returns
 */
exportImg: (name?: string) => Promise<void>;
```

### exportCanvas

Exporting canvas with chart content is only supported on the browser side. You can use this canvas for secondary processing, such as adding watermarks, etc.

```ts
/**
 * Export the canvas with the chart content drawn
 * @returns HTMLCanvasElement
 * @since 1.5.2
 */
exportCanvas: () => HTMLCanvasElement | undefined;
```

### getImageBuffer

Currently only the node environment is supported for node-side image export.

```ts
 getImageBuffer: () => void;
```

### setLayout

Set a custom layout.

```ts
/**
 * Set up a custom layout
 */
setLayout: (layout: LayoutCallBack) => void;

type LayoutCallBack = (
  chart: IChart,
  item: ILayoutItem[],
  chartLayoutRect: IRect,
  chartViewBox: IBoundsLike
) => void;
```

### reLayout

Force a relayout.

```ts
 reLayout: () => void;
```

### getCompiler

Get the compiler instance.

```ts
getCompiler: () => Compiler;
```

### getChart

Get the Chart chart instance.

```ts
getChart: () => IChart;
```

### getStage

Get the rendering engine instance.

```ts
getStage: () => Stage;
```

### getCanvas

Get canvas dom.

```ts
getCanvas: () => HTMLCanvasElement | undefined;
```

### getContainer

Gets the DOM container for the chart.

```ts
getContainer: () => Maybe<HTMLElement>;
```

### getComponents

Gets all component instances of the chart.

```ts
getComponents: () => IComponent[];
```

### getDataSet

Support since version `1.10.4`;

Gets a DataSet instance of the chart.

```ts
getDataSet: () => DataSet;
```

### getScale

Gets a Scale instance of the chart

```ts
getScale: (scaleId: string) => IBaseScale;
```

### setDimensionIndex

Manually invoked to trigger the dimension interaction.

```ts
/**
 * Manually invoked to trigger the dimension interaction.
 * @param value dimension value
 * @param options
 * @returns
 */
setDimensionIndex: (value: StringOrNumber, options: DimensionIndexOption = {}) => void;

type DimensionIndexOption = {
  // When there are multiple axes, use filter to filter the axis to trigger the dimension effect
  // Currently only ordinal axes can trigger the dimension effect
  filter?: (cmp: IComponent) => boolean;
  // Whether to trigger tooltip, default is true
  tooltip?: boolean;
  // The showTooltipOption parameter when the tooltip is triggered, please refer to the description in api-showTooltip above
  showTooltipOption?: IShowTooltipOption;
  // Whether to trigger crosshair, default is true
  crosshair?: boolean;
};

```

[Related example](https://visactor.io/vchart/demo/line-chart/line-default-select)

### convertDatumToPosition

Obtain the corresponding chart coordinate position according to the data in the dataset. The data needs to be obtained from the dataset passed into the chart. If the data does not exist in the dataset, the `convertValueToPosition` method can be used.

```ts
/**
 * Convert the data to coordinate position
 * @param datum the datum to convert
 * @param dataLinkInfo the data link info, could be seriesId or seriesIndex, default is { seriesIndex: 0 }
 * @param isRelativeToCanvas Whether relative to canvas coordinates, default is false
 * @param checkInViewData Check if the corresponding element of the data is in the view. If it is not in the view, return null
 * @returns
 */
convertDatumToPosition: (
  datum: Datum,
  dataLinkInfo?: DataLinkSeries,
  isRelativeToCanvas?: boolean,
  checkInViewData?: boolean
) => IPoint | null;
```

### convertValueToPosition

Convert the value to the corresponding canvas coordinate point.

```ts
/**
 * Convert the value to coordinate position
 * @param value number | [number, number], the value to convert
 * @param dataLinkInfo the data link info, could be seriesId,seriesIndex,axisId,axisIndex
 * @param isRelativeToCanvas whether relative to canvas coordinates, default is false
 * returns
 */
convertValueToPosition: ((value: StringOrNumber, dataLinkInfo: DataLinkAxis, isRelativeToCanvas?: boolean) =>
  number | null) &
  ((value: [StringOrNumber, StringOrNumber], dataLinkInfo: DataLinkSeries, isRelativeToCanvas?: boolean) =>
    IPoint | null);
```

### updateIndicatorDataById

Update the indicator component data based on the component id specified in the spec.

```ts
  /**
   * Update the indicator component data based on the component id specified in the spec.
   * @param id Indicator id in spec.
   * @param datum Data Item.
   * @since 1.11.7
   */
  updateIndicatorDataById: (id: string, datum?: Datum) => void;
```

### updateIndicatorDataByIndex

Update the indicator component data based on the component index in the spec.

```ts
  /**
   * Update the indicator component data based on the component index in the spec.
   * @param index Indicator index in spec.
   * @param datum Data Item
   * @since 1.11.7
   */
  updateIndicatorDataByIndex: (index: number = 0, datum?: Datum) => void;
```

### geoZoomByIndex

Map Zoom API. Specifies the geo coordinate of a region by index order for zooming.

```ts
/**
 * Map Zoom API
 * @param [regionIndex=0] Specifies the geo coordinate of a region by index order for zooming
 * @param zoom Zoom ratio
 * @param center Zoom center
 * @since 1.11.10
 */
  geoZoomByIndex: (regionIndex: number, zoom: number, center?: { x: number; y: number }) => void;
```

### geoZoomById

Map Zoom API. Specifies the geo coordinate of a region by id for zooming

```ts
/**
 * Map Zoom API
 * @param regionId Specifies the geo coordinate of a region by id for zooming
 * @param zoom Zoom ratio
 * @param center Zoom center
 * @since 1.11.10
 */
  geoZoomById: (regionId: string | number, zoom: number, center?: { x: number; y: number }) => void;
```
