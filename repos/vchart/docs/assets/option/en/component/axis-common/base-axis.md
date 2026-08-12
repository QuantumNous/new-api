{{ target: component-base-axis }}

{{ use: common-component-id(
  prefix = ${prefix}
) }}

#${prefix} visible(boolean) = true

Whether or not to display the axes, default display.

#${prefix} mode('2d'|'3d') = '2d'

Is it the axis in 3D mode? The axis style in 3D mode may differ from that in 2D mode.

#${prefix} depth(number)

The configuration of the z-axis in 3D mode is used to define the length of the z-axis (the length of the x-axis is width, the length of the y-axis is height, and the length of the z-axis is depth).

#${prefix} sampling(boolean) = true

If or not axis data sampling is enabled, the default is enabled. When axis sampling is enabled, axis data will be sampled and displayed to prevent overlapping of axis data. You can control the spacing between axis labels by configuring `label.minGap`.

{{ if: ${coordType} === 'cartesian' }}
#${prefix} orient(string)

Axis position.

Optional values:

- `'left'`: left side
- `'top'`: top
- `'right'`: right side
- ``bottom'`: bottom
- `'z'`: z-axis (can be used in 3d scatter, 3d line, 3d area maps, z-axis can be configured when zField is configured)
  {{ else }}
  #${prefix} orient(string)

Axis position, enumerated type, supports: `'radius'` and `'angle'`.

- `'radius'` represents the radius axis.
- `'angle'` represents the angle axis.

#${prefix} inside(boolean) = false

**Only works for angular axes, i.e. when `orient: 'angle'` **, when innerRadius is configured, axes can be shown in inner circles by setting inside: true.

#${prefix} radius(number)

The outer radius of the axis, value range 0 - 1.
{{ /if }}

#${prefix} inverse(boolean) = false

Whether to turn on reverse axes.

#${prefix} hover(boolean) = false

If or not the hover interaction is enabled, default is off.

#${prefix} select(boolean) = false

If or not the select interaction is enabled, the default is off.

{{ if: ${type} === 'linear' }}
{{ import: component-linear-axis }}
{{ elif: ${type} === 'band' }}
{{ import: component-band-axis }}
{{ elif: ${type} === 'time' }}
{{ import: component-time-axis }}
{{ elif: ${type} === 'log' }}
{{ import: component-log-axis }}
{{ elif: ${type} === 'symlog' }}
{{ import: component-symlog-axis }}
{{ /if }}
{{ /if }}

{{ if: ${coordType} === 'cartesian' }}
{{ use: component-cartesian-axis-common(
  prefix = ${prefix}
) }}
{{ else }}
{{ use: component-polar-axis-common(
  prefix = ${prefix}
) }}
{{ /if }}

#${prefix} tick(Object)

Coordinate axis scale configuration.

##${prefix} visible(boolean)

Whether or not the scale line is displayed.

##${prefix} tickSize(number) = 4

The length configuration of the coordinate axis scale lines.

##${prefix} inside(boolean) = false

Scale line orientation, default outward (coordinate lines enclose the outside of the box).

##${prefix} alignWithLabel(boolean) = true

If or not the tick is aligned with the label, the default is true, which means it is aligned, if it is set to false, it will be displayed in the middle of the two scales before and after.

##${prefix} tickStep(number)

tick Step length.

##${prefix} tickCount(number|function) = 5

The recommended number of ticks does not guarantee that the result will be the configured value.
Since version` 1.4.0`, in **continuous axes**, tickCount supports being configured as a function, typically used to dynamically configure the number of ticks. The function definition is as follows:

```ts
tickCount?: (option: {
  axisLength?: number;  // The pixel size of the axis. In cartesian coordinate system, it refers to the width or height of the axis. In polar coordinates, it refers to the length of the radius axis.
  labelStyle?: ITextGraphicAttribute; // The style of axis labels.
}) => number;
```

##${prefix} forceTickCount(number)

Forcing the number of ticks to be set ensures that the number of ticks matches the set value, but may cause the tick value to be a decimal due to the data range.

##${prefix} tickMode('average'|'d3'|function) = 'average'

The continuous axis tick generation algorithm, supported since version `1.3.0`, **only takes effect when the axis is a linear axis**.

- 'average': Ticks are evenly distributed based on the axis range as much as possible.
- 'd3': Generates tick values like the default logic of d3, using a base of [1, 2, 5].
- `CustomTicksFunc`: Custom ticks, supported since version `1.12.0`, **only effective when the axis is linear**. The specific usage is as follows:

```ts
/**
 * @typedef {function} CustomTicksFunc
 * @param {ContinuousScale} scale - The scale object of the continuous axis
 * @param {number} tickCount - The number of ticks to generate
 * @returns {number[]} - The array of generated ticks
 */
tickMode: CustomTicksFunc<ContinuousScale>;
/**
 * @example
 */
tickMode: (scale, tickCount = 5) => {
  const domain = scale.domain();
  const step = (domain[1] - domain[0]) / (tickCount - 1);
  return Array.from({ length: tickCount }, (_, i) => domain[0] + i * step);
};
```

##${prefix} noDecimals(boolean) = false

Avoiding decimal ticks, supported since version `1.3.0`, **only takes effect when the axis is a linear axis**.

##${prefix} dataFilter(Function)

The function definition for tick data filtering is as follows:

```ts
  /**
   * :: Data filtering for ticks
   * @param data
   * @param context since 1.13.9
   * @returns
   */
  dataFilter?: (data: AxisItem[], context: {vchart: IVChart}) => AxisItem[];
```

##${prefix} style(Object|Function)

Scale line style settings, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Scale line style'
) }}

example:

```ts
tick: {
  style: (value, index) => {
    if (index === 3) {
      return {
        visible: false // hidden
      };
    }

    return {
      stroke: 'red'
    };
  };
}
```

{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

Configure the style of the scale line in different interaction states, **it takes effect when hover/select interaction is enabled**, currently the axis supports the following four interaction states:

- 1. hover
- 2. hover_reverse
- 3. selected
- 4. selected_reverse

###${prefix} hover(Object|Function)

The style configuration when the element is hovered, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'ticker hover state style'
) }}

example:

```ts
tick: {
  state: {
    hover: (value, index) => {
      if (index === 3) {
        return {
          visible: false // hidden
        };
      }

      return {
        stroke: 'red'
      };
    };
  }
}
```

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} hover_reverse(Object|Function)

Styles configured when other elements are hovered. Function callbacks are supported, so you can use them when you need to go through some personalized configuration.

{{ use: component-common-style-callback(
  description = 'Scale hover_reverse status style'
) }}

example:

```ts
tick: {
  state: {
    hover_reverse: (value, index) => {
      if (index === 3) {
        return {
          visible: false // hidden
        };
      }

      return {
        stroke: 'red'
      };
    };
  }
}
```

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected(Object|Function)

Style configuration when the element is selected, support function callback, when need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Scale line selected status style'
) }}

example:

```ts
tick: {
  state: {
    selected: (value, index) => {
      if (index === 3) {
        return {
          visible: false // hidden
        };
      }

      return {
        stroke: 'red'
      };
    };
  }
}
```

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected_reverse(Object|Function)

Other elements are selected when the style configuration, support for function callback, when you need to go some personalized configuration can use the callback function.

{{ use: component-common-style-callback(
  description = 'Scale line selected_reverse status style'
) }}

example:

```ts
tick: {
  state: {
    selected_reverse: (value, index) => {
      if (index === 3) {
        return {
          visible: false // hidden
        };
      }

      return {
        stroke: 'red'
      };
    };
  }
}
```

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

#${prefix} subTick(Object)

Subscalar Configuration.

##${prefix} visible(boolean) = false

Whether or not to display the subscale line.

##${prefix} tickCount(number) = 4

Subscale format, defaults to 4.

##${prefix} inside(boolean) = false

Subscale orientation, defaults to outward (coordinate lines enclose the outside of the box).

##${prefix} tickSize(number) = 2

The length configuration of the subscale.

##${prefix} style(Object)

The sub-scale line style setting.

{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

Configure the style of the subscale in different interaction states, **it takes effect when hover/select interaction is enabled**, currently the axis supports the following four interaction states:

- 1. hover
- 2. hover_reverse
- 3. selected
- 4. selected_reverse

###${prefix} hover(Object)

The style configuration of the element when it is hovered.

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} hover_reverse(Object)

The style configuration of the other elements when they are hovered.

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected(Object)

The style configuration when the element is selected.

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected_reverse(Object)

The style configuration when other elements are selected.

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

#${prefix} animation(boolean) = false

Whether to turn on animation, off by default.

#${prefix} animationAppear(Object|boolean)

Chart entry animation. boolean type is used to enable/disable this animation.

{{ use: animate-state-animate(
  prefix = '#' + ${prefix},
  noPreset = true,
  noOneByOne = true
) }}

#${prefix} animationEnter(Object|boolean)

Data Update - New data animation. boolean type is used to turn this animation on/off.

{{ use: animate-state-animate(
  prefix = '#' + ${prefix},
  noPreset = true,
  noOneByOne = true
) }}

#${prefix} animationUpdate(Object|boolean)

Data Update - Data update animation. boolean type is used to turn this animation on/off.

{{ use: animate-state-animate(
  prefix = '#' + ${prefix},
  noPreset = true,
  noOneByOne = true
) }}

#${prefix} animationExit(Object|boolean)

Data Update - Data Delete animation. boolean type is used to enable/disable this animation.

{{ use: animate-state-animate(
  prefix = '#' + ${prefix},
  noPreset = true,
  noOneByOne = true
) }}

{{ use: common-region-and-series-filter(
  prefix = ${prefix},
) }}

{{ use: common-layout-item(
  prefix = ${prefix},
  defaultLayoutType = 'region-relative',
  defaultLayoutLevel = 30,
  defaultLayoutZIndex = 100,
  noOrient = true
) }}
