{{ target: component-label }}

#${prefix} visible(boolean) = false

Display chart data labels or not, by default labels are not displayed.

#${prefix} interactive(boolean) = false

Whether the data label graphic element supports interaction events, not supported by default.

#${prefix} textType(deprecated)

Supported since version 1.7.0, text type.

After version 1.10.0, it is recommended to use formatMethod to configure rich text.

Optional:

- 'text'
- 'rich'

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

#${prefix} formatter(string)

String template, supported since `1.7.0` version.

A string template that wraps the variable name with `{}`. The variable name is taken from the data attribute value.

In pie charts, percentage stacked area charts, percentage stacked line charts, and percentage stacked column charts, percentage configuration is supported, `{_percent_}`

For example, `formatter: 'type={type},value={value},percent={_percent_}'`

For detailed usage, please refer to the [Tutorial Document](/vchart/guide/tutorial_docs/Chart_Plugins/Formatter).

#${prefix} syncState(boolean) = false

The ability to synchronize the state changes of data graphics has been supported since version `1.9.0`. You can refer to the [demo](/vchart/demo/label/bar-label-syncState) for usage.

{{ if: !${noOffset} }}

{{ var: offsetNumber = ${defaultOffset} !== undefined ? ${defaultOffset} : 0 }}

#${prefix} offset(number)= ${offsetNumber}

{{ /if}}

The distance between the label and its corresponding data graphic element.

{{ if: !${noPosition} }}

#${prefix} position(string)

{{ /if }}

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

{{ if: ${hasOverlap} }}

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

{{ /if }}

{{ if: ${hasSmartInvert} }}

#${prefix} smartInvert(Object|false)

Smart Invert configuration.

- In a histogram, when the label position is inside (`'inside'` | `'inside-top'` | `'inside-bottom'` | `'inside-right'` | `'inside-left'`) , it is enabled by default.

##${prefix} mode(string)

Contrast measure.

Optional:

- 'WCAG': Measure contrast using the Web Content Accessibility Guidelines. This standard is used by default. More details can be found at https://webaim.org/resources/contrastchecker/.
- 'lightness': Use color brightness to measure contrast. More details can be found at https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl#l.

##${prefix} textType(string)

Text type. Corresponds to different color contrast standards to ensure the readability of the text.

The default is `'normalText'`.

Optional values:

- `'largeText'` Large text. WCAG 2.0 AA level requires large text contrast to be at least 3:1. Large text is defined as bold font 14pt (usually 18.66 pixels) or larger, or normal font 18pt (usually 24 pixels) or larger.

- `'normalText'` Regular text. WCAG 2.0 AA level requires normal text contrast to be at least 4.5:1. Text smaller than large text is considered normal text.

For more details, please refer to https://webaim.org/articles/contrast/.

##${prefix} contrastRatiosThreshold(number)

Custom contrast ratio threshold. When the color contrast between the label text color and the background graphic element color is less than this threshold, select a color from the color pool to replace the label text color to ensure text readability.

##${prefix} alternativeColors(string | string[])

Customize alternative label colors. These colors will be added to the alternative color pool. Colors that satisfy text readability will be selected from the alternative color pool to replace the label color when the contrast does not meet the threshold. The default alternative color pool includes white `‘#ffffff’` and black `‘#000000’`.

##${prefix} fillStrategy(string)

Four strategies for label fill color in intelligent inversion:

- `'base'` uses the color of the element where the label is located
- `'invertBase'` uses the color calculated by smart inversion
- `'similarBase'` uses the complementary color of the color after intelligent inversion calculation
- `'null'` does not perform smart inversion and keeps the color set by `style.fill`

The default setting is `'invertBase'`

##${prefix} strokeStrategy(string)

Four strategies for label stroke color in intelligent inversion:

- `'base'` uses the color of the element where the label is located
- `'invertBase'` uses the color calculated by smart inversion
- `'similarBase'` uses the complementary color of the color after intelligent inversion calculation
- `'null'` does not perform smart inversion and keeps the color set by `style.stroke`

The default setting is `'base'`

##${prefix} brightColor(string)

similarSeries uses this color when the foreground color has contrast with the bright color.
The default setting is '#ffffff'.

##${prefix} brightColor(string)

similarSeries uses this color when the foreground color has contrast with the dark color.
The default setting is '#000000'.

##${prefix} outsideEnable(boolean)

If the label exceeds the mark range, mark will also be used as the background color for inversion.
The default setting is `false`.

##${prefix} interactInvertType('none' | 'stroked' | 'inside')
Supported since version 1.12.8

When the label intersects with the graphic but is not completely inside the mark, three handling methods are supported:

- `none`: Do nothing
- `stroked`: When the label has a stroke, handle it based on the stroke (default behavior)
- `inside`: Handle it as if the label is completely inside the mark

{{ /if }}

{{ if: !${ignoreCustom} }}

#${prefix} dataFilter(function)
Custom label data filtering and sorting. Supported since version `1.3.0`.

Returns an array set of label data with the layout order consistent with the array order. Therefore, the later data in the array will have a higher chance of colliding and being hidden. The function callback parameter is:` (data: LabelItem[]) => LabelItem[]`

```ts
export type LabelItem = {
  id?: string;
  data?: any;
} & ITextGraphicAttribute;
```

#${prefix} customLayoutFunc(function)
Custom label layout function. Supported since version `1.3.0`.

When `customLayoutFunc` is configured, the default layout and overlap prevention logic will no longer take effect (`position`/`offset` will not be effective).

The function callback parameter is: `(item: LabelItem[], labels: (IText | IRichText)[], getRelatedGraphic: (data: LabelItem) => IGraphic, getRelatedPoint?: (data: LabelItem) => IPointLike) => (IText | IRichText)[]`.
Example usage:

```js
const layout = (attribute, text, getRelatedGraphic) => {
  return text.map(t => {
    const barRect = getRelatedGraphic(t.attribute);
    if (barRect) {
      const x = Math.abs(baseMark.AABBBounds.x1 + baseMark.AABBBounds.x2) / 2;
      const y = Math.abs(barRect.AABBBounds.y1 + barRect.AABBBounds.y2) / 2;
      t.setAttributes({ x, y });
    }
    return t;
  });
};
```

#${prefix} customOverlapFunc(function)
Custom label avoidance function. Supported since version `1.3.0`.

When `customOverlapFunc` is configured, and if `customLayoutFunc` is not also configured, it will initially perform a layout based on position and offset before entering the custom avoidance logic. The configured overlap prevention logic (`overlap`) will not take effect.
The type definition of the function is as follows, where the last parameter `labelComponent` is supported since version `1.13.5`, and it returns the label component instance.

```ts
(
  /**
   * The graphic node corresponding to the label, which may be a text graphic or a rich text graphic, generated according to the configuration.
   */
  label: (IText | IRichText)[],
  /**
   * Get the graphic associated with the data corresponding to the label, suitable for scenarios such as displaying bar labels, scatter labels, etc.
   */
  getRelatedGraphic: (data: LabelItem) => IGraphic,
  /**
   * Get the point coordinates associated with the data corresponding to the label, suitable for scenarios such as displaying labels corresponding to line chart elements, area chart elements, etc.
   */
  getRelatedPoint: ((data: LabelItem) => IPointLike) | null | undefined,
  /**
   * Label component instance
   */
  labelComponent: IGroup
  ) => (IText | IRichText)[];
```

#${prefix} onAfterOverlapping(function)
Callback function after overlap calculation is completed. Supported since version `1.3.5`.

The type definition of the function is as follows, with parameters defined the same as `customOverlapFunc`:

```ts
(
    label: (IText | IRichText)[],
    getRelatedGraphic: (data: LabelItem) => IGraphic,
    getRelatedPoint: ((data: LabelItem) => IPointLike) | null | undefined,
    labelComponent: IGroup
  ) => (IText | IRichText)[];
```

{{ /if }}

#${prefix} animation(boolean|object)
Label animation. Setting false can turn off label animation.

##${prefix} duration(number)=300
Label animation execution duration.

##${prefix} delay(number)=0
Label animation execution delay, default to 0.

##${prefix} easing(string)="linear"

Label animation easing, default to `'linear'`.

##${prefix} mode('same-time' | 'after' | 'after-all')="same-time"
Label animation playback timing. Defaults to "same-time".

- `'same-time'`: Starts simultaneously with the animation of the associated data element.
- `'after'`: Starts after the animation of the associated data element finishes.
- `'after-all'`: Starts after the animations of all data elements finish.

  ##${prefix} increaseEffect(boolean)=true
  Enable number increase animation while label data updated.

#${prefix} stackDataFilterType('min'|'max')

Effective from version 1.12.0

Used for filtering stacked group data

- 'min' displays labels for the maximum value in the stacked group
- 'max' displays labels for the minimum value in the stacked group

#${prefix} showRelatedMarkTooltip(boolean)=false

Available since version 1.13.5.

The default value is `false`, which means hovering over the label will not trigger the tooltip.
When set to `true`, hovering over the label will trigger the mark tooltip of its associated graphic.
