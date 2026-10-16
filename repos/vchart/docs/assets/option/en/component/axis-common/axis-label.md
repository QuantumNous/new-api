{{ target: component-axis-label }}

<!-- ILabel -->

Axis Label Configuration.

#${prefix} visible(boolean) = true

Whether to display the axis label.

#${prefix} type(deprecated)

Supported since version 1.7.0, text type.
After version 1.10.0, it is recommended to use formatMethod to configure rich text.

Optional:

- 'text'
- 'rich'

#${prefix} formatMethod(Function)

Axis label content formatting function, the function definition is as follows:

```ts
  /**
   * :: Axis label content formatting functions
   * @param text Original label text value
   * @param datum Graphic data
   * @returns Formatted text
   */
  formatMethod?: (text: string | string[], datum?: any) => string | string[]
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

#${prefix} formatter(string | string[])

Formatter string template, supported since version `1.10.0`.

The string template with the variable name wrapped in `{}`, the variable name is taken from the data attribute value.

For example: `formatter: '{label:~s}'`

For detailed usage, please refer to the [Tutorial Document](/vchart/guide/tutorial_docs/Chart_Plugins/Formatter) and [Demo](/vchart/demo/label/label-formatter).

#${prefix} space(number)

The distance between the label and the scale.

#${prefix} inside(boolean) = false

Label orientation, default outward (coordinate lines enclose the outside of the box).

#${prefix} minGap(number) = 4

Minimum spacing (in pixels) between labels, ** only in effect when axis sampling starts (`sampling: true`)**. This configuration affects the results of axis sampling.

#${prefix} dataFilter(Function)

The function definition for label data filtering is as follows:

```ts
  /**
   * :: Data filtering for labels
   * @param data
   * @param layer
   * @param context since 1.13.9
   * @returns
   */
  dataFilter?: (data: AxisItem[], layer: number, context: {vchart: IVChart}) => AxisItem[];
```

#${prefix} style(Object|Function)

Axis label style settings, support for function callbacks, when you need to go some personalized configuration can use the callback function.

{{ use:component-common-style-callback(
  description = 'Axis label style'
) }}

Example:

```ts
label: {
  style: (value, index) => {
    if (index === 3) {
      return {
        fill: 'blue'
      };
    }

    return {
      fill: 'red'
    };
  };
}
```

{{ use: graphic-text(
  prefix = '#' + ${prefix}
) }}

#${prefix} state(Object)

The style configuration of the label in different interaction states, **it takes effect when hover/select interaction is enabled in the axes**, currently the axes support the following four interaction states:

- 1. hover
- 2. hover_reverse
- 3. selected
- 4. selected_reverse

##${prefix} hover(Object|Function)

The style configuration when the element is hovered, supports function callbacks, so you can use the callback function when you need to go through some personalized configurations.

{{ use:component-common-style-callback(
  description = 'Axis label hover state style'
) }}

Example:

```ts
label: {
  state: {
    hover: (value, index) => {
      if (index === 3) {
        return {
          fill: 'blue'
        };
      }

      return {
        fill: 'red'
      };
    };
  }
}
```

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} hover_reverse(Object|Function)

Styles configured when other elements are hovered. Function callbacks are supported, so you can use them when you need to go through some personalized configuration.

{{ use:component-common-style-callback(
  description = 'Axis label hover_reverse status style'
) }}

Example:

```ts
label: {
  state: {
    hover_reverse: (value, index) => {
      if (index === 3) {
        return {
          fill: 'blue'
        };
      }

      return {
        fill: 'red'
      };
    };
  }
}
```

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} selected(Object|Function)

Style configuration when the element is selected, support function callback, when need to go some personalized configuration can use the callback function.

{{ use:component-common-style-callback(
  description = 'Axis label selected status style'
) }}

Example:

```ts
label: {
  state: {
    selected: (value, index) => {
      if (index === 3) {
        return {
          fill: 'blue'
        };
      }

      return {
        fill: 'red'
      };
    };
  }
}
```

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} selected_reverse(Object|Function)

Other elements are selected when the style configuration, support for function callback, when you need to go some personalized configuration can use the callback function.

{{ use:component-common-style-callback(
  description = 'Axis label selected_reverse status style'
) }}

Example:

```ts
label: {
  state: {
    selected_reverse: (value, index) => {
      if (index === 3) {
        return {
          fill: 'blue'
        };
      }

      return {
        fill: 'red'
      };
    };
  }
}
```

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}
