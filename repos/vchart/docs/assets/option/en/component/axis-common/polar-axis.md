{{ target: component-polar-axis-common }}

#${prefix} domainLine(Object)

Axis line configuration.

{{ use: component-axis-domain-line(
  prefix = '#' + ${prefix}
) }}

#${prefix} label(Object)

Axis label configuration.

{{ use: component-axis-label(
  prefix  = '#' + ${prefix}
) }}

##${prefix} autoHide(boolean) = false

** Supported since version 1.12.6 **
Axis label auto-hide switch, default is off, **must be manually enabled, and `sampling` must be turned off**.

##${prefix} autoHideMethod('parity'|'greedy'|CustomMethod) = 'parity'

Only effective when `autoHide` is true, anti-overlap strategy, default is 'parity'.

- - 'parity': Parity check, uses a strategy of removing all other labels (this is very effective for standard linear axes).
- - 'greedy': Performs a linear scan of labels and removes all labels overlapping with the last visible label.
- - `CustomMethod` type can also be passed a function for a custom strategy.

```ts
export type CustomMethod = (items: IText[], separation: number) => IText[];
```

##${prefix} autoHideSeparation(number) = 0

** Supported since version 1.12.6 **
Effective only when `autoHide` is true, sets the distance between texts, unit px.

##${prefix} autoLimit(boolean) = false

** Supported since version 1.12.6 **
Axis label truncation switch, default is off, **must be manually enabled, and `sampling` must be turned off**.

##${prefix} limitEllipsis(string) = '...'

** Supported since version 1.12.6 **
Effective only when `autoLimit` is true, the ellipsis placeholder, default is '...'.

##${prefix} autoWrap(boolean) = false

Automatic label wrapping, supported since version `1.12.6`.

You can configure the maximum number of line breaks using the `label.style.lineClamp` option.

##${prefix} layoutFunc(function)

Automatic label wrapping, supported since version `1.12.6`.
Effective when `sampling` is turned off, custom layout configuration. If `layoutFunc` is declared, the default anti-overlap configurations (`autoHide`, `autoRotate`, `autoLimit`) will not take effect.

The function definition for this property is as follows:

```ts
  /**
    * Custom layout configuration. If `layoutFunc` is declared, the default anti-overlap configurations (`autoHide`, `autoRotate`, `autoLimit`) will not take effect.
    * @param labels Label graphic elements
    * @param labelData Label data
    * @param layer The current layer of the axis
    * @param axis The current axis component instance
    * @returns void
    */
    layoutFunc?: (labels: IText[], labelData: AxisItem[], layer: number, axis: IGroup) => void;
```

#${prefix} title(Object)

Axis title configuration.

{{ use: component-axis-title(
  prefix = '#'+ ${prefix}
) }}

#${prefix} grid(Object)

Grid line configuration.

##${prefix} smooth(boolean) = false

When smooth is set to true, the grid is circular, otherwise it's a polygonal grid.

{{ use: component-axis-grid(
  prefix = '#' + ${prefix}
) }}

#${prefix} subGrid(Object)

Sub-grid line configuration.

##${prefix} smooth(boolean) = false

When smooth is set to true, the grid is circular, otherwise it's a polygonal grid.

{{ use: component-axis-grid(
  prefix = '#' + ${prefix}
) }}
