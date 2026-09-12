{{ target: component-total-label }}

#${prefix} visible(boolean) = false

堆叠总计标签是否显示，默认不展示。

请注意，堆叠总计标签仅当图表支持堆叠配置（`stack: true`）时支持使用。

#${prefix} interactive(boolean) = false

标签图元是否支持交互事件，默认不支持。

#${prefix} position('top' | 'bottom') = 'top'

堆叠总计标签的位置。自 `1.13.7` 版本支持。

#${prefix} formatMethod(Function)

数据标签内容格式化函数，函数定义如下：

```ts
  /**
   * 标签内容格式化函数
   * @param text 原始标签文本值
   * @param datum 图形数据
   * @returns 格式化后的文本
   */
  formatMethod?: (text: string | string[], datum?: any) => string | string[] | number |  number[]
```

自`1.10.0`后，支持返回富文本配置，例如：

```ts
formatMethod: text => {
  return {
    type: 'rich',
    text: [
      {
        text,
        fontSize: 14,
        fontWeight: 'bold',
        fill: 'red'
      },
      {
        text: 'Rich Text',
        fontSize: 10,
        lineThrough: true,
        underline: true,
        fill: 'green'
      }
    ]
  };
};
```

更详细的富文本使用方式请参考[富文本教程](/vchart/guide/tutorial_docs/extend/Richtext_and_Dom)

#${prefix} style(Object)

标签图元样式配置。

##${prefix} type='text'(Object)

常规文本样式配置。

{{ use: graphic-text(
   prefix = '##' + ${prefix}
) }}

##${prefix} type='rich'(Object)

富文本样式配置。

{{ use: graphic-rich-text(
   prefix = '##' + ${prefix}
) }}

#${prefix} state(Object)

##${prefix} hover(Object)
hover 状态样式配置。

{{ use: graphic-text(
   prefix = '##' + ${prefix}
) }}

##${prefix} hover_reverse(Object)
未 hover 状态样式配置。

{{ use: graphic-text(
   prefix = '##' + ${prefix}
) }}

##${prefix} selected(Object)
选中状态样式配置。

{{ use: graphic-text(
   prefix = '##' + ${prefix}
) }}

##${prefix} selected_reverse(Object)
未选中状态样式配置。

{{ use: graphic-text(
   prefix = '##' + ${prefix}
) }}

#${prefix} overlap(Object|false)

标签防重叠配置，默认开启。

##${prefix} hideOnHit(boolean) = true

检测到标签发生重叠后，是否隐藏放不下的标签。

##${prefix} clampForce(boolean) = true

是否约束标签必须在绘图区域内。

##${prefix} avoidBaseMark(boolean) = false

是否躲避标签对应的基础图元，在折线图/散点图/雷达图的点图元标签会默认开启，其他图表中默认关闭。

若图表配置同时显示 totalLabel 和 label，则 totalLabel 的布局优先级将高于 label。

##${prefix} strategy(Array)

发生重叠后，标签的躲避策略，提供了 4 种躲避策略，分别为:

- 'position'：可选位置策略。若默认位置没有足够的空间放置标签，则考虑 position 内的备选位置。

  ```ts
  export type PositionStrategy = {
    /**
     * 可选位置策略。
     * 若默认位置没有足够的空间放置标签，则考虑 position 内的备选位置。
     */
    type: 'position';
    /** position 根据图表类型支持不同支持不同的位置配置 **/
    position?: Functional<LabelPosition[]>;
    /**
     * 当 position 内的备选位置依然无法放下标签时，标签是否放回原位。
     * 默认为 true，若为 false，则标签会被放在 position 数组的最后一个位置。
     * @since 1.12.15
     * @default true
     */
    restorePosition?: boolean;
  };
  ```

- 'bound': `label.position`配置在图形内部时使用（建议仅在 rect 图元数据使用）。当图形大小不足以放下标签，则考虑 position 内的备选位置。

  ```ts
  export type BoundStrategy = {
    /**
     * 标签配置在图形内部时使用。
     * 当图形大小不足以放下标签，则考虑 position 内的备选位置。
     */
    type: 'bound';
    /** position 根据图表类型支持不同支持不同的位置配置 **/
    position?: Functional<LabelPosition[]>;
    /**
     * 当 position 内的备选位置依然无法放下标签时，标签是否放回原位。
     * 默认为 true，若为 false，则标签会被放在 position 数组的最后一个位置。
     * @since 1.12.15
     * @default true
     */
    restorePosition?: boolean;
  };
  ```

- `moveY`: y 方向散开策略。若默认位置没有足够的空间放置标签，则根据 offset 在 y 方向上寻找位置。

  ```ts
  export type MoveYStrategy = {
    /**
     * y 方向散开策略。
     * 若默认位置没有足够的空间放置标签，则根据 offset 在 y 方向上寻找位置。
     */
    type: 'moveY';
    /**
     * y 方向上的尝试的位置偏移量，可配置为函数。
     */
    offset: Functional<number[]>; // number | (data: any) => number[];
  };
  ```

  - `moveX`: x 方向散开策略。若默认位置没有足够的空间放置标签，则根据 offset 在 x 方向上寻找位置。

  ```ts
  export type MoveYStrategy = {
    /**
     * x 方向散开策略。
     * 若默认位置没有足够的空间放置标签，则根据 offset 在 x 方向上寻找位置。
     */
    type: 'moveX';
    /**
     * x 方向上的尝试的位置偏移量，可配置为函数。
     */
    offset: Functional<number[]>; // number | (data: any) => number[];
  };
  ```

##${prefix} padding(Object)

防重叠区域的扩展边距，自 `1.13.7` 版本支持。默认值为`{ top: 0, bottom: 0, left: 0, right: 0}`。

默认情况下，图表标签被要求布局在 region 区域内部，若希望标签超出 region 区域布局并依然正确计算防重叠，可以配置 `padding`。
