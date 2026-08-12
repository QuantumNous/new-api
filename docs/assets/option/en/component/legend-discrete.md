{{ target: component-legend-discrete }}

<!-- IDiscreteLegendSpec Discrete Legend Configuration -->

## legends.discrete(Object)

Discrete legend configuration.

### type(string) = 'discrete'

**Optional**, discrete legend type declaration, optional as the legend type defaults to `'discrete'`.

{{ use: component-base-legend(
  prefix = '##'
) }}

### defaultSelected(Array)

Sets the legend item that is selected by default when the legend is initialized. The element in the array is the name of the legend item, e.g. `['Legend 1', 'Legend 2']` means that the legend items named `'Legend 1'` and `'Legend 2'` are selected by default.

### select(boolean) = true

Whether or not to enable the checking of the legend, the default is on.

### selectMode(string) = 'multiple'

The check mode of the legend, with optional values:

- `'multiple'` multiple selection mode
- `'single'` single selection mode
- `'focus'` focus selection mode

### scale(string)

Supported since version 1.10.5

Sets the name corresponding to the associated `scale`, by default it will automatically resolve the scale corresponding to the colors.

### scaleName(string)

Same as `scale`, for consistency with continuous legend configuration, it is recommended to use `scale` for configuration.

### field(string)

When specifying the `scale` corresponding to the legend, specify the field to parse the legend data, which only takes effect when `scale` is set.

### hover(boolean) = true

If or not hover interaction is enabled.

### allowAllCanceled(boolean) = false

Whether to allow all legend items to be unchecked, default is no, only valid if `selectMode` is `'multiple'`.

### reversed(boolean) = false

Whether to reverse the ordering of the legend items, the default is not.

### maxWidth(number)

The overall maximum width of the legend, which determines whether horizontally laid out legends (with an orientation attribute of `'left'` | `'right'`) are automatically line-breaking.

### maxCol(number|Function)

Effective only when `orient` is `'left'` | `'right'`, indicates the maximum number of columns for the legend item, the legend item beyond the maximum number of columns will be hidden.

Since version `2.0.23`, a callback `(ctx) => number` is also supported, evaluated during layout so the column count can adapt to the space allocated to the legend (it is re-evaluated on every layout pass, so it also updates automatically on resize). The callback receives `ctx` as `{ rect, orient, id }`: `rect` is the layout size allocated to the legend `{ width, height }` (no position), `orient` is the legend's resolved orientation (defaults to `'left'` when `orient` is unset), and `id` is the legend id.

### maxHeight(number)

The maximum height of the legend as a whole, which determines whether vertically laid out legends (with an orientation attribute of `'top'` | `'bottom'`) are automatically line-breaking.

### maxRow(number|Function)

Effective only when `orient` is `'top'` | `'bottom'`, indicates the maximum number of rows for the legend item, the legend item beyond the maximum number of rows will be hidden.

Since version `2.0.23`, a callback `(ctx) => number` is also supported, evaluated during layout so the row count can adapt to the space allocated to the legend (it is re-evaluated on every layout pass, so it also updates automatically on resize). The callback receives `ctx` as `{ rect, orient, id }`: `rect` is the layout size allocated to the legend `{ width, height }` (no position), `orient` is the legend's resolved orientation (defaults to `'left'` when `orient` is unset), and `id` is the legend id.

### lazyload(boolean)

Supported since version 1.12.12

Whether to enable lazy loading, the default is off. Note that it is recommended to use it in conjunction with the legend scrollbar. When lazy loading is enabled, the rendering of legend items will be delayed, and they will only be rendered when they enter the visible area. The initial and final states of the scrollbar will also differ.

### item(Object)

Legend Item Configuration, which contains the configuration of graphics, text, etc. within the legend item.

#### visible(boolean) = true

Whether or not to display the legend item, the default is displayed.

#### spaceCol(number)

Column spacing for legend items, horizontal spacing.

#### spaceRow(number)

Line spacing for legend items, vertical spacing.

#### maxWidth(number|string)

The maximum width of the legend item, defaults to null. a percentage can be used to indicate the percentage of the width of the display area.

#### width(number|string)

The width of the legend item, calculated automatically by default. A percentage can be used, indicating the percentage of the width of the display area.

#### height(number|string)

Height setting for legend items, not set, automatically calculated by default. A percentage can be used, indicating the percentage of the height of the display area.

#### padding(number|number[]|Object)

{{ use: common-padding(
  componentName='Legend item'
) }}

#### align(string) = 'left'

Supported since version `1.10.0`;

Specifies the placement of icons and text in legend items, with optional values:

- 'left': Icon on the left
- 'right': Icon on the right

#### autoEllipsisStrategy(string) = 'none'

Supported since version `1.10.0`;

When label + value coexist, the automatic ellipsis strategy is:

- 'labelFirst' - Attempt to display the complete `label`
- 'valueFirst' - Attempt to display the complete `value`
- 'none' - Display label and value according to `widthRatio`

#### background(Object)

The background configuration of the legend item.

##### visible(boolean) = false

Whether or not to show the legend item background.

##### style(Object|Function)

Legend item background style configuration, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item background style',
  componentType = 'discrete-legend'
) }}

example:

```ts
background: {
  style: () => {},
}
```

{{ use: graphic-rect(
  prefix = '#####'
) }}

##### state(Object)

Style configuration of the legend item background in different interaction states, the current interaction states supported by the legend component are:

- `'selected'`: Selected state
- `'unSelected'`: Unselected state
- `'selectedHover'`: Selected and hover state
- `'unSelectedHover'`: Unselected and hover state

###### selected(Object|Function)

Background selected state style configuration , support function callback , when need to go some personalized configuration can use the callback function .

{{ use: component-common-style-callback(
  description = 'Legend item background selected state style',
  componentType = 'discrete-legend'
) }}

example:

```ts
background: {
  state: {
    selected: () => {};
  }
}
```

{{ use: graphic-rect(
  prefix = '######'
) }}

###### unSelected(Object|Function)

Background non-checked state of the style configuration , support function callback , when need to go some personalized configuration can use the callback function .

{{ use: component-common-style-callback(
  description = 'Legend item background unSelected status style',
  componentType = 'discrete-legend'
) }}

example:

```ts
background: {
  state: {
    unSelected: () => {};
  }
}
```

{{ use: graphic-rect(
  prefix = '######'
) }}

###### selectedHover(Object|Function)

Background selected and hover state style configuration, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item background selectedHover state style',
  componentType = 'discrete-legend'
) }}

example:

```ts
background: {
  state: {
    selectedHover: () => {};
  }
}
```

{{ use: graphic-rect(
  prefix = '######'
) }}

###### unSelectedHover(Object|Function)

Style configuration for background unchecked and hover state, support function callback, when need to go some personalized configuration you can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item background unSelectedHover state style',
  componentType = 'discrete-legend'
) }}

example:

```ts
background: {
  state: {
    unSelectedHover: () => {};
  }
}
```

{{ use: graphic-rect(
  prefix = '######'
) }}

#### shape(Object)

Configuration of the shape icon for the legend item.

##### visible(boolean) = false

Whether to show the shape icon of the legend item.

##### space(number)

The spacing between the shape and the label after it.

##### style(Object|Function)

shape icon style configuration, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item shape style',
  componentType = 'discrete-legend'
) }}

example:

```ts
shape: {
  style: () => {};
}
```

{{ use: graphic-symbol(
  prefix = '#####'
) }}

##### state(Object)

The legend item shape is configured in different interaction states, currently the legend component supports the following interaction states:

- `'selected'`: Selected state
- `'unSelected'`: Unselected state
- `'selectedHover'`: Selected and hover state
- `'unSelectedHover'`: Unselected and hover state

###### selected(Object|Function)

The legend item shape supports function callbacks for configuring the style of the selected state, so that you can use the callback function when you need to go through some personalized configurations.

{{ use: component-common-style-callback(
  description = 'Legend item shape selected state style',
  componentType = 'discrete-legend'
) }}

example:

```ts
shape: {
  state: {
    selected: () => {};
  }
}
```

{{ use: graphic-symbol(
  prefix = '######'
) }}

###### unSelected(Object|Function)

Legend item shape state style configuration, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item shape unSelected state style',
  componentType = 'discrete-legend'
) }}

example:

```ts
shape: {
  state: {
    unSelected: () => {}.
  }
}
```

{{ use: graphic-symbol(
  prefix = '######'
) }}

###### selectedHover(Object|Function)

Legend item shape selected and hover state style configuration, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item selectedHover state style',
  componentType = 'discrete-legend'
) }}

example:

```ts
shape: {
  state: {
    selectedHover: () => {};
  }
}
```

{{ use: graphic-symbol(
  prefix = '######'
) }}

###### unSelectedHover(Object|Function)

Legend item shape unchecked and hover state style configuration, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Style for the selectedHover status of the legend item.',
  componentType = 'discrete-legend'
) }}

example:

```ts
shape: {
  state: {
    unSelectedHover: () => {};
  }
}
```

{{ use: graphic-symbol(
  prefix = '######'
) }}

#### label(Object)

Text configuration of the legend item.

##### space(number)

The spacing between the legend item label and the value that follows it.

##### widthRatio(number)

Supported since version `1.10.0`

When label + value are displayed simultaneously and the text is too long, the width ratio of the label

##### formatMethod(Function)

label's text formatting method, you can customize the display text of the label. The parameters of the function are:

```ts
/**
 * @params text Original text
 * @params item Drawing data for legend item
 * @params index Index of the legend item
 */
(text: StringOrNumber, item: LegendItemDatum, index: number) => any;
```

The legend item is drawn with the data type:

```ts
export type LegendItemDatum = {
  /**
   * :: A unique identifier for this piece of data, which can be used for animations or lookups
   */
  id?: string;
  /** Display text */
  label: string;
  /** Display of data */
  value?: string | number;
  value: string | number;
  value: string | number;
  value: string | number;
  /** Definition of shape before legend item */
  shape: {
    symbolType?: string;
    fill?: string;
    stroke?: string;
  };
  [key: string]: any;
};
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

#### formatter(string | string[])

Formatter string template, supported since version `1.10.0`.

The string template with the variable name wrapped in `{}`, the variable name is taken from the data attribute value.

For example: `formatter: '{label:~s}'`

For detailed usage, please refer to the [Tutorial Document](/vchart/guide/tutorial_docs/Chart_Plugins/Formatter) and [Demo](/vchart/demo/label/label-formatter).

##### style(Object|Function)

Legend item label style configuration, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item label styles',
  componentType = 'discrete-legend'
) }}

example:

```ts
label: {
  style: () => {};
}
```

{{ use: graphic-text(
  prefix = '#####'
) }}

##### state(Object)

The style configuration of the legend item label in different interaction states, currently the legend component supports the following interaction states:

- `'selected'`: selected state
- `'unSelected'`: non-selected state
- `'selectedHover'`: selected and hover state
- `'unSelectedHover'`: unselected and hover state

###### selected(Object|Function)

The legend item label supports function callbacks to configure the style of the selected state, so you can use the callback function when you need to go through some personalized configurations.

{{ use: component-common-style-callback(
  description = 'Legend item label selected state style',
  componentType = 'discrete-legend'
) }}

example:

```ts
label: {
  state: {
    selected: () => {};
  }
}
```

{{ use: graphic-text(
  prefix = '######'
) }}

###### unSelected(Object|Function)

Legend item label unchecked state style configuration, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item label unSelected status style',
  componentType = 'discrete-legend'
) }}

example:

```ts
label: {
  state: {
    unSelected: () => {}.
  }
}
```

{{ use: graphic-text(
  prefix = '######'
) }}

###### selectedHover(Object|Function)

Legend item label selected and hover state style configuration, support function callback, when you need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item label selectedHover Status Style',
  componentType = 'discrete-legend'
) }}

example:

```ts
label: {
  state: {
    selectedHover: () => {};
  }
}
```

{{ use: graphic-text(
  prefix = '######'
) }}

###### unSelectedHover(Object|Function)

Legend item label unchecked and hover state style configuration, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item label unSelectedHover Status Style',
  componentType = 'discrete-legend'
) }}

example:

```ts
label: {
  state: {
    unSelectedHover: () => {};
  }
}
```

{{ use: graphic-text(
  prefix = '######'
) }}

#### value(Object)

The value of the legend entry is configured.

##### space(number)

The spacing between the legend item value and the following element.

##### alignRight(boolean) = false

Whether or not to align the value to the right side of the legend item as a whole, **only if the legend item width `itemWidth` is set**.

##### widthRatio(number)

Supported since version `1.10.0`

When label + value are displayed simultaneously and the text is too long, the width ratio of the value

##### formatMethod(Function)

value's text formatting method, you can customize the display text of value. The parameters of the function are:

```ts
/**
 * @params text Original text
 * @params item Drawing data for legend item
 * @params index Index of the legend item
 */
(text: StringOrNumber, item: LegendItemDatum, index: number) => any;
```

The legend item is drawn with the data type:

```ts
export type LegendItemDatum = {
  /**
   * :: A unique identifier for this piece of data, which can be used for animations or lookups
   */
  id?: string;
  /** Display text */
  label: string;
  /** Display of data */
  value?: string | number;
  value: string | number;
  value: string | number;
  value: string | number;
  /** Definition of shape before legend item */
  shape: {
    symbolType?: string;
    fill?: string;
    stroke?: string;
  };
  [key: string]: any;
};
```

##### style(Object|Function)

Legend item value style configuration, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item value styles',
  componentType = 'discrete-legend'
) }}

example:

```ts
value: {
  style: () => {},
}
```

{{ use: graphic-text(
  prefix = '#####'
) }}

##### state(Object)

The legend item value configures the style in different interaction states, currently the legend component supports the following interaction states:

- `'selected'`: selected state
- `'unSelected'`: non-selected state
- `'selectedHover'`: selected and hover state
- `'unSelectedHover'`: unselected and hover state

###### selected(Object|Function)

The legend item value supports callback functions for configuring the style of the selected state, so that you can use the callback function when you need to go through some personalized configurations.

{{ use: component-common-style-callback(
  description = 'Legend item value selected status style',
  componentType = 'discrete-legend'
) }}

example:

```ts
value: {
  state: {
    selected: () => {};
  }
}
```

{{ use: graphic-text(
  prefix = '######'
) }}

###### unSelected(Object|Function)

Legend item value Style configuration for unchecked state, support function callback, you can use the callback function when you need to go some personalized configuration.

{{ use: component-common-style-callback(
  description = 'Legend item value unSelected Status Style',
  componentType = 'discrete-legend'
) }}

example:

```ts
value: {
  state: {
    unSelected: () => {}.
  }
}
```

{{ use: graphic-text(
  prefix = '######'
) }}

###### selectedHover(Object|Function)

Legend item value selected and hover state style configuration, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item value selectedHover Status Style',
  componentType = 'discrete-legend'
) }}

example:

```ts
value: {
  state: {
    selectedHover: () => {};
  }
}
```

{{ use: graphic-text(
  prefix = '######'
) }}

###### unSelectedHover(Object|Function)

Legend item value unchecked and hover state style configuration, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Legend item value unSelectedHover Status Style',
  componentType = 'discrete-legend'
) }}

example:

```ts
value: {
  state: {
    unSelectedHover: () => {};
  }
}
```

{{ use: graphic-text(
  prefix = '######'
) }}

#### focus(boolean) = false

Whether to enable the legend focus feature, which is disabled by default.

#### focusIconStyle(Object)

Focus button style configuration.

{{ use: graphic-symbol(
  prefix = '####'
) }}

### autoPage(boolean) = true

Whether to enable automatic page turning, the default is on.

### pager(Object)

Page Turner Configuration.

#### type(string)

Supported since version `1.10.0`

Set the pager type, currently supporting two styles:

- Default style: pager with arrows
- `type: 'scrollbar'`: Scrollbar pager

#### layout(string)

The layout of the page turner, the optional values are `'horizontal'` and `'vertical'`. The default value logic is:

- Defaults to `'vertical'` when legend `orient` is `'left'` or `'right'`.
- Defaults to `'horizontal'` when legend `orient` is `'top'` or `'bottom'`.

#### defaultCurrent(number)

Default current page number.

#### padding(number|number[]|Object)

{{ use: common-padding(
  componentName='Pager'
) }}

#### space(number)

The spacing of the page turner from the same legend.

#### animation(boolean) = true

Whether to turn on animation.

#### animationDuration(number) = 450

Animation duration in ms.

#### animationEasing(string) = 'quadIn'

Animated jogging effect.

#### textStyle(Object)

Text style configuration.

This configuration only applies to the default pager

{{ use: graphic-text(
  prefix = '####'
) }}

#### handler(Object)

This configuration only applies to the default pager

Style configuration for the page turner button.

##### space(number) = 8

The spacing between the buttons and the text content area, the default is 8.

##### preShape(string)

The shape of the button on the previous page of the page turner.

##### nextShape(string)

The shape of the page turner next button.

##### style(Object)

Style configuration for the page turner button.

{{ use: graphic-symbol(
  prefix = '#####'
) }}

##### state(Object)

Configuration of the style of the page flipper buttons in different interaction states, the current interaction states supported by the page flipper are:

- `'hover'`: hover state
- `'disable'`: not available status style

###### hover(Object)

The style configuration for the hover state of the page turner button.

{{ use: graphic-symbol(
  prefix = '######'
) }}

###### disable(Object)

Style configuration for the unavailable state of the page turner button.

{{ use: graphic-symbol(
  prefix = '######'
) }}

#### railStyle

Supported since version `1.10.0`

This configuration only applies to the scrollbar page turner
Scrollbar slider style configuration.

{{ use: graphic-rect(
  prefix = '####'
) }}

#### sliderStyle

Supported since version `1.10.0`

This configuration only applies to the scrollbar page turner
Scrollbar track style configuration.

{{ use: graphic-rect(
  prefix = '####'
) }}

#### scrollByPosition(boolean)

Supported since version `1.10.0`

This configuration only applies to the scrollbar page turner
Whether the scrollbar position supports displaying in the middle of the pagination

#### scrollMask(Object)

Supported starting from version `1.12.11`.

A mask for the legend area when scrolling, before reaching the end.

##### visible(boolean) = false

Whether to display the mask.

##### gradientLength(number) = 16

Length of the gradient area of the mask.

##### gradientStops(Object)

Configuration for the gradient fill colors of the mask, for example:

```ts
scrollMask: {
  visible: true,
  gradientStops: [
    { offset: 0, color: 'rgba(255,255,255,1)' },
    { offset: 0.5, color: 'rgba(255,255,255,0.8)' },
    { offset: 1, color: 'rgba(255,255,255,0)' }
  ]
}
```

### data(Function)

Custom Configuration for Discrete Legend Data is a function that can be customized based on the original legend plotting data, for example, the value value can be customized.

```ts
// Type of legend data
type LegendItemDatum = {
  /**
   * :: A unique identifier for this piece of data, which can be used for animations or lookups
   */
  id?: string;
  /** Display text */
  label: string;
  /** Display of data */
  value?: string | number; value: string | number; value: string | number; value: string | number
  /** Definition of shape before legend item */
  shape: {
    symbolType?: string;
    fill?: string;
    stroke?: string;
    stroke?: boolean;
  };
  [key: string]: any;
};

/**
 * Customization based on the data plotted in the original legend, e.g., you can customize the value value
 * @param data Legend drawing data
 * @returns
 */
data?: (data: LegendItemDatum[]) => LegendItemDatum[];
/**
 * Customization based on the data plotted in the original legend, e.g., you can customize the value value
 * @param data Legend drawing data
 * @param colorScale Global color map scale
 * @param globalScale All scales on the chart
 * @returns
 */
data?: (data: LegendItemDatum[], colorScale: IBaseScale, globalScale: IGlobalScale) => LegendItemDatum[];
```

{{ use: common-region-and-series-filter(
  prefix = '##',
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'normal',
  defaultLayoutLevel = 50,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}
