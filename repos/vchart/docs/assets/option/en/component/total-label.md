{{ target: component-total-label }}

#${prefix} visible(boolean) = false

Whether to display the total stack label, not displayed by default.

Please note that the total stack label is only supported when the chart supports stack configuration (`stack: true`).

#${prefix} interactive(boolean) = false

Whether the data label graphic element supports interaction events, not supported by default.

#${prefix} position('top' | 'bottom') = 'top'

The position of the total label. Supported since version `1.13.7`.

#${prefix} formatMethod(Function)

The data label content formatting function, defined as follows:

```ts
  /**
   * label format method
   * @param text origin text
   * @param datum graphic data
   * @returns formatted text
   */
  formatMethod?: (text: string | string[], datum?: any) => string | string[] | number |  number[]
```

Since version `1.10.0`, `formatMethod` supports return richText structure like:

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

For specific usage of rich text, please refer to the[Rich Text Tutorial Document](/vchart/guide/tutorial_docs/extend/Richtext_and_Dom)

#${prefix} style(Object)

Label graphic element style configuration.

##${prefix} type='text'(Object)

Regular text style configuration.

{{ use: graphic-text(
   prefix = '##' + ${prefix}
) }}

##${prefix} type='rich'(Object)

Rich text style configuration.

{{ use: graphic-rich-text(
   prefix = '##' + ${prefix}
) }}

#${prefix} state(Object)

Label state style configuration.

##${prefix} hover(Object)
Hover state style configuration.

{{ use: graphic-text(
   prefix = '##' + ${prefix}
) }}

##${prefix} hover_reverse(Object)

Non-hover state style configuration.

{{ use: graphic-text(
   prefix = '##' + ${prefix}
) }}

##${prefix} selected(Object)
Selected state style configuration.

{{ use: graphic-text(
   prefix = '##' + ${prefix}
) }}

##${prefix} selected_reverse(Object)
Non-selected state style configuration.

{{ use: graphic-text(
   prefix = '##' + ${prefix}
) }}

#${prefix} overlap(Object|false)

Label anti-overlap configuration.

##${prefix} hideOnHit(boolean) = true

Whether to hide the labels that cannot be placed due to overlapping detection.

##${prefix} clampForce(boolean) = true

Whether to constrain labels to be within the plotting area.

##${prefix} avoidBaseMark(boolean) = false

Whether to avoid the label corresponding to the base graphic element. In line charts / scatter plots / radar charts, the point element labels will be turned on by default, while in other charts, they are turned off by default.

##${prefix} strategy(Array)

Overlap avoidance strategy for labels, providing 4 avoidance strategies, respectively:

- 'position': Optional position strategy. If the default position does not have enough space to place the label, consider the alternative positions within the position.

  ```ts
  export type PositionStrategy = {
    /**
     * Optional position strategy.
     * If the default position does not have enough space to place the label, consider the alternative positions within the position.
     */
    type: 'position';
    /**  position supports different configurations depending on the chart type **/
    position?: Functional<LabelPosition[]>;
    /**
     * When the alternative positions in position still cannot accommodate the label, whether the label is returned to its original position.
     * The default is true, if false, the label will be placed in the last position of the position array.
     * @since 1.12.15
     * @default true
     */
    restorePosition?: boolean;
  };
  ```

- 'bound': Use when `label.position` is configured inside the graphic element (recommended for rect data element only). If the graphic size is not enough to accommodate the label, consider the alternative positions within the position.

  ```ts
  export type BoundStrategy = {
    /**
     * Used when configuring labels inside a graphic.
     * If the graphic size is insufficient to accommodate the label, consider alternative positions within the position.
     */
    type: 'bound';
    /**  position supports different configurations depending on the chart type **/
    position?: Functional<LabelPosition[]>;
    /**
     * When the alternative positions in position still cannot accommodate the label, whether the label is returned to its original position.
     * The default is true, if false, the label will be placed in the last position of the position array.
     * @since 1.12.15
     * @default true
     */
    restorePosition?: boolean;
  };
  ```

- `moveY`: Y-direction scatter strategy. If the default position does not have enough space to place the label, find the position in the Y-direction based on the offset.

  ```ts
  export type MoveYStrategy = {
    /**
     * Y-direction dispersion strategy.
     * If the default position does not have enough space to place the label, find a position in the y-direction based on the offset.
     */
    type: 'moveY';
    /**
     * The position offset in the y-direction can be configured as a function.
     */
    offset: Functional<number[]>; // number | (data: any) => number[];
  };
  ```

  - `moveX`: X-direction scatter strategy. If the default position does not have enough space to place the label, find the position in the X-direction based on the offset.

  ```ts
  export type MoveYStrategy = {
    /**
     * X-direction dispersion strategy.
     * If the default position does not have enough space to place the label, find a position in the x-direction based on the offset.
     */
    type: 'moveX';
    /**
     * The position offset in the x-direction can be configured as a function.
     */
    offset: Functional<number[]>; // number | (data: any) => number[];
  };
  ```

##${prefix} padding(Object)

防重叠区域的扩展边距，自 `1.13.7` 版本支持。默认值为`{ top: 0, bottom: 0, left: 0, right: 0}`。

默认情况下，图表标签被要求布局在 region 区域内部，若希望标签超出 region 区域布局并依然正确计算防重叠，可以配置 `padding`。
