# Event

The VChart instance provides methods related to event monitoring, and developers can monitor events to meet business needs. In addition to basic dom events, the events provided on VChart also include component events, TTL events, etc.

Below is a simple monitor diagram `click` Examples of events:

```ts
vchart.on('click', params => {
  console.log('Hooray, You are captured');
});
```

## Event API

The registration and uninstallation methods of events are provided on the VChart instance:

- Register an event

```ts
on(event: string, callback: (params: EventParams) => void): void;
on(event: string, query: EventQuery, callback: (params: EventParams) => void): void;
```

- Uninstall event

```ts
off(event: string, callback: (params: EventParams) => void): void;
```

Example:

```ts
vchart.on('pointerdown', e => {
  console.log('Hooray, You are captured');
}); // bind event
vchart.on('pointerdown', { level: 'model', type: 'axis' }, e => {
  console.log('Hooray, You are captured');
}); // bind axis `pointerdown` event
vchart.off('pointerdown', callback); // off event
```

### event parameters

All events provide parameters of the following structure:

```ts
type EventParams = {
  /**
   * event object
   */
  event: SuperEvent;
  /**
   * For different events to store the data expected to be carried
   */
  value?: any;
  /**
   * The mark of the event source
   */
  mark?: IMark;
  /**
   * The model of the event source
   */
  model?: IModel;
  /**
   * The chart of the event source
   */
  chart?: IChart;
  /**
   * The data of the primitive picked up by the event
   */
  datum?: Datum;
  /**
   * Picked graphics node
   */
  node?: INode;
};

type SuperEvent = Event & {
  [key: string]: any;
};
```

### Event filtering

Event filtering configuration (parameter `query: EventQuery`) is optional. If you need to specifically monitor events in a certain part of the chart, you can use the built-in query rules for configuration. Currently, we provide the following filtering rules:

1. `source`, filter according to the event source, that is, listen to the events of the window or the chart itself.

```ts
//Listen to the pointerdown event on the window
vchart.on('pointerdown', { source: 'window' }, () => {});
```

2. `level`, filter according to the event bubbling level. The bubbling order of events is: 'mark' -> 'model' -> 'chart' -> 'vchart'.

```ts
//Listen to the pointerdown event on the bar primitive
vchart.on('pointerdown', { level: 'mark', type: 'bar' }, () => {});
```

3. `nodeName`, filter according to the picked graphics node name. Inside vchart, some component names will be built in for some components to facilitate user identification.

```ts
//Listen to the pointerdown event on the axis text
vchart.on('pointerdown', { nodeName: 'axis-label' }, () => {});
```

4. `markName`, filter according to the name of mark primitive.

```ts
//Listen to the pointerdown event on the bar primitive
vchart.on('pointerdown', { markName: 'bar' }, () => {});
```

5. `type`, **only used in scenarios where level is 'mark' or 'model'**, is used to filter mark types or chart component element model types

```ts
//Listen to the pointerdown event on the coordinate axis
vchart.on('pointerdown', { level: 'model', type: 'axis' }, () => {});
```

6. `id`, filter based on the id configured by the user on the spec for the chart component

```ts
//Listen to the component event with id 'axis-left'
vchart.on('pointerdown', { id: 'axis-left' }, () => {});
```

7. `filter`, when none of the above filtering configurations meet the needs, you can filter through a custom filtering function

```ts
vchart.on('pointerdown', { filter: ({model} => model.id === 45) }, () => {});
```

In addition to the above configurations, `query` also supports the following configurations:

| Configuration | Type      | Default | Description                                                   |
| ------------- | --------- | ------- | ------------------------------------------------------------- |
| consume       | `Boolean` | `false` | Whether to stop event propagation                             |
| throttle      | `Number`  | `null`  | Duration of event throttling in ms, defaults to no throttling |
| debounce      | `Number`  | `null`  | Duration of event debouncing in ms, defaults to no debouncing |

#### Listen to component events through event filtering

Through the following event filtering rules, we can monitor the events of each component on the VChart example

```ts
/**
 * 'pointerdown' is the event name
 * Need to declare in event filtering:
 * 1. `level` is declared as 'model'
 * 2. `type` declares the name of the component
 */
vchart.on('pointerdown', { level: 'model', type: 'axis' }, e => {
  // The specific graphics picked up by the current event can be obtained through e.event.target
  console.log('axis pointerdown', e.event.target);
});
```

However, it should be noted that not all components enable event interaction by default. For components that are turned off by default, users need to manually enable them on the spec corresponding to the component (such as enabling label event interaction: `label: { interactive: true }`) , the following table lists the current component names of our VChart and how its events are turned on and off by default. You can refer to this table for specific use.

| Component type | Whether to enable event support by default |
| -------------- | ------------------------------------------ |
| axis           | Yes                                        |
| dataZoom       | Yes                                        |
| indicator      | Yes                                        |
| legend         | Yes                                        |
| mapLabel       | Yes                                        |
| customMark     | Yes                                        |
| title          | Yes                                        |
| markLine       | No                                         |
| markArea       | No                                         |
| markPoint      | No                                         |
| label          | No                                         |
| totalLabel     | No                                         |

#### Monitor mark primitive events through event filtering

If you want to listen to the events of mark primitives, you can do it in two ways:

1. Use `markName` to filter, such as:

```ts
// Listen to the pointerdown event on the bar primitive
vchart.on('pointerdown', { markName: 'bar' }, (e: EventParams) => {
  console.log('bar pointerdown', e);
});
```

2. Use the `{ level: 'mark', type: 'bar' }` rule to filter, such as:

```ts
// Listen to the pointerdown event on the bar primitive
vchart.on('pointerdown', { level: 'mark', type: 'bar' }, (e: EventParams) => {
  console.log('bar pointerdown', e);
});
```

If you want to listen to the events of all primitives, you only need to declare `level: 'mark'`, such as `vchart.on('pointerdown', { level: 'mark'}, e => {})`

The specific primitive types (corresponding to the types configured on the spec) are: 'point', 'line', 'area', 'bar', 'bar3d', 'boxPlot', 'outlier', 'circlePacking', 'dot ', 'funnel','funnel3d', 'link', 'pie', 'rose', 'pie3d', 'word', 'fillingWord', etc.

## Event classification

### base event

VChart supports the following basic events:

- PointerEvent Pointer event
  - `'pointerdown'`
  - `'pointerup'`
  - `'pointerupoutside'`: The graph is not triggered at the same time when the pointer is raised and pressed
  - `'pointertap'`: click event under pointerEvent
  - `'pointerover'`
  - `'pointermove'`
  - `'pointerenter'`: will not bubble
  - `'pointerleave'`: will not bubble
  - `'pointerout'`
- MouseEvent Mouse event
  - Left button operation
    - `'mousedown'`
    - `'mouseup'`
    - `'mouseupoutside'`: The graphics are not triggered at the same time when the mouse is raised and pressed
  - Right click operation
    - `'rightdown'`
    - `'rightup'`
    - `'rightupoutside'`: The graphics are not triggered at the same time when the mouse is raised and pressed
  - `'click'`
  - `'dblclick'`
  - `'mousemove'`
  - `'mouseover'`
  - `'mouseout'`
  - `'mouseenter'`: will not bubble
  - `'mouseleave'`: will not bubble
  - `'wheel'` Roller event
- TouchEvent Touch event
  - `'touchstart'`
  - `'touchend'`
  - `'touchendoutside'`
  - `'touchmove'`
  - `'touchcancel'`
  - `'tap'`: click event under touchEvent
- Drag event
  - `'dragstart'`
  - `'dragend'`
  - `'drag'`
  - `'dragenter'`
  - `'dragleave'`
  - `'dragover'`
  - `'drop'`
- Gesture event

  - `'pan'`: translation
  - `'panstart'`: translation start
  - `'panend'`: end of translation
  - `'press'`: long press
  - `'pressup'`: long press release
  - `'pressend'`: long press end
  - `'pinch'`: zoom
  - `'pinchstart'`: zoom start
  - `'pinchend'`: zoom end
  - `'swipe'`: quick sweep

  Note that gesture events are not enabled by default. There are two ways to enable them:

  - Set `mode` in the rendering configuration to one of the following: `'mobile-browser'`, `'miniApp'`, `'lynx'`, `'wx'`, `'harmony'`
  - Set `gestureConfig` in the rendering configuration to a non-empty object. For specific supported configurations, refer to [vchart API configuration](/vchart/api/API/vchart)

### combined event

- `dimensionHover`: Dimension hovering event
- `dimensionClick`: Dimension click event

### Component event

#### DataZoom

- `'dataZoomChange'`

Events fired after DataZoom filtering.

The event parameters are as follows:

```ts
{
  /** The Model instance of the event source */
  model: IModel;
  /** The data carried by the event */
  value: {
    /** Whether to perform data filtering */
    filterData: boolean;
    /** Current starting value, percentage value, 0 - 1 */
    start: number;
    /** Current end value, percentage value, 0 - 1 */
    end: number;
    /** Current start value, original value */
    startValue: number;
    /** Current end value, original value */
    endValue: number;
    /** Current value range */
    newDomain: any[];
  }
}
```

#### ScrollBar

- `'scrollBarChange'`

Event triggered after ScrollBar scrolls.

The event parameters are as follows:

```ts
{
  /** The Model instance of the event source */
  model: IModel;
  /** The data carried by the event */
  value: {
    /** Whether to perform data filtering */
    filterData: boolean;
    /** Current starting value, percentage value, 0 - 1 */
    start: number;
    /** Current end value, percentage value, 0 - 1 */
    end: number;
    /** Current start value, original value */
    startValue: number;
    /** Current end value, original value */
    endValue: number;
    /** Current value range */
    newDomain: any[];
  }
}
```

#### Brush

- `'brushStart'`

Brush The event triggered the box starts to select.

- `'brushChange'`

Brush The event triggered after the box is selected.

- `'brushEnd'`

Brush The event triggered the box selected has been finished.

- `'brushClear'`

Brush The event triggered the box selected has been finished.

The event parameters are as follows:

```ts
{
  /** The Model instance of the event source */
  model: IModel;
  /** The data carried by the event */
  value: {
    /** operation type */
    operateType: string;
    /** The region being operated on */
    operateRegion: IRegion;
    // element data inside the marquee
    inBrushData: any[];
    // element data outside the marquee
    outOfBrushData: any[];
    // in the linked series: element data inside the marquee
    linkInBrushData: any[];
    // in the linked series: element data outside the marquee
    linkOutOfBrushData: any[];
    /** vgrammar elements inside the marquee */
    inBrushElementsMap: { [brushName: string]: { [elementKey: string]: IElement } };
    /** vgrammar elements outside the marquee */
    outOfBrushElementsMap: { [elementKey: string]: IElement };
    /** In linked series: vgrammar elements inside marquee */
    linkedInBrushElementsMap: { [brushName: string]: { [elementKey: string]: IElement } };
    /** In linked series: vgrammar elements outside the marquee */
    linkedOutOfBrushElementsMap: { [elementKey: string]: IElement };
     /** record of axis and datazoom change */
    zoomRecord: {
      operateComponent: AxisComponent | DataZoom;
      start: number;
      end: number;
      /** since 1.13.5+ version */
      startValue: number | string;
      endValue: number | string;
    }[];
  }
}
```

#### Drill

The chart of the hierarchical data structure supports the drilling function and the events triggered after drilling. At present, the built-in charts in VChart support drilling: CirclePacking, Sunburst, and Treemap.

- `'drill'`

Drill events triggered after drilling.

The event parameters are as follows:

```ts
{
  /** The Model instance of the event source */
  model: IModel;
  /** The data carried by the event */
  value: {
    /** Drill type, drillDown: drill down, drillUp: drill up */
    type: 'drillDown' | 'drillUp';
    /** Drill path */
    path: string[];
  }
}
```

#### Legend

Legend related events.

- `'legendItemClick'` **discrete type**Legend click event

The event parameters are as follows:

```ts
{
  /** The Model instance of the event source */
  model: IModel;
  /** Currently selected legend item data */
  value: string[];
}
```

- `'legendItemHover'` **discrete type**Legend hover event

The event parameters are as follows:

```ts
{
  /** The Model instance of the event source */
  model: IModel;
  /** The data carried by the event */
  value: {
    /** The currently selected legend item as a whole, the VRender graphics object */
    item: VRenderGroup;
    /** The data of the current legend item */
    data: Object;
    /** Whether the current legend item is selected */
    selected: boolean;
    /** All selected legend items in the current legend */
    currentSelectedItems: VRenderGroup[];
    /** Data of all selected legend items in the current legend */
    currentSelected: string[];
  }
}
```

- `'legendItemUnHover'` **discrete type**Legend unhover event

The event parameters are as follows:

```ts
{
  /** The Model instance of the event source */
  model: IModel;
  /** The data carried by the event */
  value: {
    /** The currently selected legend item as a whole, the VRender graphics object */
    item: VRenderGroup;
    /** The data of the current legend item */
    data: Object;
    /** Whether the current legend item is selected */
    selected: boolean;
    /** All selected legend items in the current legend */
    currentSelectedItems: VRenderGroup[];
    /** Data of all selected legend items in the current legend */
    currentSelected: string[];
  }
}
```

- `'legendFilter'` **Continuous type**Legend Filter Event

The event parameters are as follows:

```ts
{
  /** The Model instance of the event source */
  model: IModel;
  /** The data range filtered by the current legend */
  value: [number, number];
}
```

### TTL event

- `'initialized'` Chart instance initialization completion event

- `'rendered'` Triggered when the chart rendering method is called, indicating that the chart has already executed the rendering logic and will only be triggered once.

- `'renderFinished'` Supported since `1.2.0` version, , the event triggered every time the canvas is rendered, excluding the end of the animation

- `'animationFinished'` Supported since `1.2.0` version, event fired when the chart animation ends

- `'layoutStart'` Layout start event

- `'layoutEnd'` Layout end event

- `'afterResize'` Triggered when the chart resized

The event parameters are as follows:

```ts
{
  /**
   * The chart of the event source
   */
  chart: IChart;
  /**
   * the instance of VChart
   */
  vchart: IVChart;
}
```
