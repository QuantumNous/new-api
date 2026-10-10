# 事件

VChart 实例上提供了事件监听相关的方法，开发者可以通过监听事件来满足业务需求。VChart 上提供的事件除了基础的 dom 事件外，还包含了组件事件、生命周期事件等。

下面就是一个简单的监听图表 `click` 事件的例子：

```ts
vchart.on('click', params => {
  console.log('Hooray, You are captured');
});
```

## 事件 API

VChart 实例上提供了事件的注册及卸载方法：

- 注册事件

```ts
on(event: string, callback: (params: EventParams) => void): void;
on(event: string, query: EventQuery, callback: (params: EventParams) => void): void;
```

- 卸载事件

```ts
off(event: string, callback: (params: EventParams) => void): void;
```

示例：

```ts
vchart.on('pointerdown', e => {
  console.log('Hooray, You are captured');
}); // 绑定事件
vchart.on('pointerdown', { level: 'model', type: 'axis' }, e => {
  console.log('Hooray, You are captured');
}); // 绑定 axis 上的 `pointerdown` 事件
vchart.off('pointerdown', callback); // 卸载事件
```

### 事件参数

所有的事件都会提供如下结构的参数：

```ts
type EventParams = {
  /**
   * 原始事件对象
   */
  event: SuperEvent;
  /**
   * 供不同的事件用于存储期望携带的数据
   */
  value?: any;
  /**
   * 事件来源的 mark
   */
  mark?: IMark;
  /**
   * 事件来源的 model
   */
  model?: IModel;
  /**
   * 事件来源的 chart
   */
  chart?: IChart;
  /**
   * 事件拾取到的图元的数据
   */
  datum?: Datum;
  /**
   * 拾取到的图形节点
   */
  node?: INode;
};

type SuperEvent = Event & {
  [key: string]: any;
};
```

### 事件过滤

事件过滤配置（参数`query: EventQuery`）为可选配置，当需要针对性得监听图表某部分的事件，可以使用内置的 query 规则进行配置，目前我们提供了如下方式的过滤规则：

1. `source`，根据事件源进行过滤，即监听 window 还是 chart 本身的事件。

```ts
// 监听 window 上的 pointerdown 事件
vchart.on('pointerdown', { source: 'window' }, () => {});
```

2. `level`，根据事件冒泡层级进行过滤，事件的冒泡顺序分别为：'mark' -> 'model' -> 'chart' -> 'vchart'。

```ts
// 监听 bar 图元 上的 pointerdown 事件
vchart.on('pointerdown', { level: 'mark', type: 'bar' }, () => {});
```

3. `nodeName`，根据拾取到的图形节点名称进行过滤，在 vchart 内部，会为一些组件内置一些组件名，方便用户识别。

```ts
// 监听坐标轴文本上的 pointerdown 事件
vchart.on('pointerdown', { nodeName: 'axis-label' }, () => {});
```

4. `markName`，根据 mark 图元的名称进行过滤。

```ts
// 监听 bar 图元 上的 pointerdown 事件
vchart.on('pointerdown', { markName: 'bar' }, () => {});
```

5. `type`，**仅在 level 为 'mark' 或者 'model' 的场景下使用**，用于筛选 mark 类型或者图表组成元素模型类型

```ts
// 监听坐标轴上的 pointerdown 事件
vchart.on('pointerdown', { level: 'model', type: 'axis' }, () => {});
```

6. `id`，根据用户在 spec 上为图表部件配置的 id 进行筛选过滤

```ts
// 监听 id 为 'axis-left' 的组件事件
vchart.on('pointerdown', { id: 'axis-left' }, () => {});
```

7. `filter`，当以上筛选配置均不满足需求时，可以通过自定义过滤函数进行筛选

```ts
vchart.on('pointerdown', { filter: ({model} => model.id === 45) }, () => {});
```

`query`除了上述配置外，还支持以下配置：

| 配置     | 类型      | 默认值  | 说明                                  |
| -------- | --------- | ------- | ------------------------------------- |
| consume  | `Boolean` | `false` | 是否阻止事件冒泡                      |
| throttle | `Number`  | `null`  | 事件节流的时长，单位为 ms，默认不节流 |
| debounce | `Number`  | `null`  | 事件防抖的时长，单位为 ms，默认不防抖 |

#### 通过事件过滤监听 组件 事件

通过如下事件过滤规则，我们可以监听到 VChart 示例上各个组件的事件

```ts
/**
 * 'pointerdown' 为 事件名称
 * 在事件过滤中需要声明：
 * 1. `level` 声明为 'model'
 * 2. `type` 声明了组件的名称
 */
vchart.on('pointerdown', { level: 'model', type: 'axis' }, e => {
  // 通过 e.event.target 可以获取到当前事件拾取到的具体图形
  console.log('axis pointerdown', e.event.target);
});
```

但是需要注意并不是所有组件在默认情况下是开启事件交互的，对于默认关闭的组件需要用户手动在组件对应的 spec 上开启（如开启 label 的事件交互：`label: { interactive: true }`），下面表格列出了目前我们 VChart 的组件名称以及其事件默认开启关闭的情况，在具体使用时可以查阅该表格。

| 组件类型   | 是否默认开启事件支持 |
| ---------- | -------------------- |
| axis       | 是                   |
| dataZoom   | 是                   |
| indicator  | 是                   |
| legend     | 是                   |
| mapLabel   | 是                   |
| customMark | 是                   |
| title      | 是                   |
| markLine   | 否                   |
| markArea   | 否                   |
| markPoint  | 否                   |
| label      | 否                   |
| totalLabel | 否                   |

#### 通过事件过滤监听 mark 图元 事件

如果想要监听 mark 图元的事件，可以通过两种方式实现：

1. 使用 `markName` 进行过滤，如：

```ts
// 监听 bar 图元 上的 pointerdown 事件
vchart.on('pointerdown', { markName: 'bar' }, (e: EventParams) => {
  console.log('bar pointerdown', e);
});
```

2. 使用 `{ level: 'mark', type: 'bar' }` 规则进行过滤，如：

```ts
// 监听 bar 图元 上的 pointerdown 事件
vchart.on('pointerdown', { level: 'mark', type: 'bar' }, (e: EventParams) => {
  console.log('bar pointerdown', e);
});
```

如果想要监听所有图元的事件，那么只需要声明 `level: 'mark'` 即可，如 `vchart.on('pointerdown', { level: 'mark'}, e => {})`

具体的图元类型（同 spec 上配置的类型对应）有：'point', 'line', 'area', 'bar', 'bar3d', 'boxPlot', 'outlier', 'circlePacking', 'dot', 'funnel','funnel3d', 'link', 'pie', 'rose', 'pie3d', 'word', 'fillingWord' 等。

## 事件分类

### 基础事件

VChart 支持如下基础事件：

- PointerEvent 指针事件
  - `'pointerdown'`
  - `'pointerup'`
  - `'pointerupoutside'`: 指针抬起与按下时图形不同时触发
  - `'pointertap'`: pointerEvent 下的 click 事件
  - `'pointerover'`
  - `'pointermove'`
  - `'pointerenter'`: 不会冒泡
  - `'pointerleave'`: 不会冒泡
  - `'pointerout'`
- MouseEvent 鼠标事件
  - 左键操作
    - `'mousedown'`
    - `'mouseup'`
    - `'mouseupoutside'`: 鼠标抬起与按下时图形不同时触发
  - 右键操作
    - `'rightdown'`
    - `'rightup'`
    - `'rightupoutside'`: 鼠标抬起与按下时图形不同时触发
  - `'click'`
  - `'dblclick'`
  - `'mousemove'`
  - `'mouseover'`
  - `'mouseout'`
  - `'mouseenter'`: 不会冒泡
  - `'mouseleave'`: 不会冒泡
  - `'wheel'` 滚轮事件
- TouchEvent 触摸事件
  - `'touchstart'`
  - `'touchend'`
  - `'touchendoutside'`
  - `'touchmove'`
  - `'touchcancel'`
  - `'tap'`: touchEvent 下的 click 事件
- 拖拽事件
  - `'dragstart'`
  - `'dragend'`
  - `'drag'`
  - `'dragenter'`
  - `'dragleave'`
  - `'dragover'`
  - `'drop'`
- 手势事件

  - `'pan'`: 平移
  - `'panstart'`: 平移开始
  - `'panend'`: 平移结束
  - `'press'`: 长按
  - `'pressup'`: 长按抬起
  - `'pressend'`: 长按结束
  - `'pinch'`: 缩放
  - `'pinchstart'`: 缩放开始
  - `'pinchend'`: 缩放结束
  - `'swipe'`: 快扫

  注意手势事件没有默认开启，有两种开启方式：

  - 渲染配置中的`mode`设置为: `'mobile-browser'`、`'miniApp'`、`'lynx'`、`'wx'`、`'harmony'`中的一种
  - 渲染配置中的`gestureConfig` 设置为非空对象，具体支持的配置参考[vchart API 配置](/vchart/api/API/vchart)

### 组合事件

- `dimensionHover`: 维度 hover 事件
- `dimensionClick`: 维度 click 事件

### 组件事件

#### DataZoom

- `'dataZoomChange'`

DataZoom 筛选后触发的事件。

事件参数如下：

```ts
{
  /** 事件来源的 Model 实例 */
  model: IModel;
  /** 事件携带的数据 */
  value: {
    /** 是否进行数据过滤 */
    filterData: boolean;
    /** 当前开始值，百分比值，0 - 1 */
    start: number;
    /** 当前结束值，百分比值，0 - 1 */
    end: number;
    /** 当前开始值，原始值 */
    startValue: number;
    /** 当前结束值，原始值 */
    endValue: number;
    /** 当前的值域 */
    newDomain: any[];
  }
}
```

#### ScrollBar

- `'scrollBarChange'`

ScrollBar 滚动后触发的事件。

事件参数如下：

```ts
{
  /** 事件来源的 Model 实例 */
  model: IModel;
  /** 事件携带的数据 */
  value: {
    /** 是否进行数据过滤 */
    filterData: boolean;
    /** 当前开始值，百分比值，0 - 1 */
    start: number;
    /** 当前结束值，百分比值，0 - 1 */
    end: number;
    /** 当前开始值，原始值 */
    startValue: number;
    /** 当前结束值，原始值 */
    endValue: number;
    /** 当前的值域 */
    newDomain: any[];
  }
}
```

#### Brush

- `'brushStart'`

Brush 框选开始事件。

- `'brushChange'`

Brush 框选后触发的事件。

- `'brushEnd'`

Brush 框选结束事件。

- `'brushClear'`

Brush 清除选框事件。

事件参数如下：

```ts
{
  /** 事件来源的 Model 实例 */
  model: IModel;
  /** 事件携带的数据 */
  value: {
    /** 操作类型 */
    operateType: string;
    /** 正在操作的region */
    operateRegion: IRegion;
    // 在选框内的 element data
    inBrushData: any[];
    // 在选框外的 element data
    outOfBrushData: any[];
    // 被链接的系列中：在选框内的 element data
    linkInBrushData: any[];
    // 被链接的系列中：在选框外的 element data
    linkOutOfBrushData: any[];
    /** 在选框内的 vgrammar elements */
    inBrushElementsMap: { [brushName: string]: { [elementKey: string]: IElement } };
    /** 在选框外的 vgrammar elements */
    outOfBrushElementsMap: { [elementKey: string]: IElement };
    /** 被链接的系列中：在选框内的 vgrammar elements */
    linkedInBrushElementsMap: { [brushName: string]: { [elementKey: string]: IElement } };
    /** 被链接的系列中：在选框外的 vgrammar elements */
    linkedOutOfBrushElementsMap: { [elementKey: string]: IElement };
    /** 轴/dataZoom的缩放操作记录 */
    zoomRecord: {
      operateComponent: AxisComponent | DataZoom;
      start: number;
      end: number;
      /** 1.13.5以上版本支持 */
      startValue: number | string;
      endValue: number | string;
    }[];
  }
}
```

#### Drill

层次数据结构的图表，支持钻取功能，钻取后触发的事件。目前 VChart 内置的图表支持钻取的有：CirclePacking、Sunburst、Treemap 这三个图表。

- `'drill'`

Drill 钻取后触发的事件。

事件参数如下：

```ts
{
  /** 事件来源的 Model 实例 */
  model: IModel;
  /** 事件携带的数据 */
  value: {
    /** 钻取类型，drillDown: 向下钻取，drillUp: 向上钻取 */
    type:  'drillDown' | 'drillUp';
    /** 钻取的路径 */
    path: string[];
  }
}
```

#### Legend

图例相关的事件。

- `'legendItemClick'` **离散类型**图例点击事件

事件参数如下：

```ts
{
  /** 事件来源的 Model 实例 */
  model: IModel;
  /** 当前被选中图例项数据 */
  value: string[];
}
```

- `'legendItemHover'` **离散类型**图例 hover 事件

事件参数如下：

```ts
{
  /** 事件来源的 Model 实例 */
  model: IModel;
  /** 事件携带的数据 */
  value: {
    /** 当前被选中的图例项整体，VRender 图形对象 */
    item: VRenderGroup;
    /** 当前图例项的数据 */
    data: Object;
    /**  当前图例项是否被选中 */
    selected: boolean;
    /** 当前图例中所有被选中的图例项 */
    currentSelectedItems: VRenderGroup[];
    /** 当前图例中所有被选中的图例项的数据 */
    currentSelected: string[];
  }
}
```

- `'legendItemUnHover'` **离散类型**图例 unhover 事件

事件参数如下：

```ts
{
  /** 事件来源的 Model 实例 */
  model: IModel;
  /** 事件携带的数据 */
  value: {
    /** 当前被选中的图例项整体，VRender 图形对象 */
    item: VRenderGroup;
    /** 当前图例项的数据 */
    data: Object;
    /**  当前图例项是否被选中 */
    selected: boolean;
    /** 当前图例中所有被选中的图例项 */
    currentSelectedItems: VRenderGroup[];
    /** 当前图例中所有被选中的图例项的数据 */
    currentSelected: string[];
  }
}
```

- `'legendFilter'` **连续类型**图例筛选事件

事件参数如下：

```ts
{
  /** 事件来源的 Model 实例 */
  model: IModel;
  /** 当前图例所筛选的数据范围 */
  value: [number, number];
}
```

### 生命周期事件

- `'initialized'` 图表内部实例初始化完成事件

- `'rendered'` 图表渲染方法被调用时触发，表明图表已经执行过渲染逻辑，只会触发一次

- `'renderFinished'` 自 `1.2.0` 版本开始支持，每次画布渲染完成触发的事件，不包含动画结束

- `'animationFinished'` 自 `1.2.0` 版本开始支持，图表动画结束时触发的事件

- `'layoutStart'` 布局开始事件

- `'layoutEnd'` 布局结束事件

- `'afterResize'` 图表尺寸变化结束时触发的事件

事件参数如下：

```ts
{
  /**
   * 事件来源的 chart
   */
  chart: IChart;
  /**
   * 全局的VChart实例
   */
  vchart: IVChart;
}
```
