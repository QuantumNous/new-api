{{ target: component-cartesian-axis-common }}

#${prefix} autoIndent(boolean)

If or not auto indent, when set to true, when the axis element is out of the drawing area and will be cropped, extra padding will be added to the chart so that the axis can be displayed in full.

#${prefix} domainLine(Object)

Axial Configuration.

{{ use: component-axis-domain-line(
  prefix = '#' + ${prefix}
) }}

##${prefix} startSymbol(Object)

Axis start point marker configuration.

{{ use: graphic-segment-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} endSymbol(Object)

Axis end point marker configuration.

{{ use: graphic-segment-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} onZero(boolean) = false

If or not the axis of X-axis or Y-axis is on the 0 scale of the other axis, it is valid only when the other axis is numeric and contains 0 scale. Default is false, user-defined.

##${prefix} onZeroAxisIndex(number)

When there are multiple axes, you can use this property to manually specify on which axis the 0 scale is.

- Tips: **This index corresponds to the index of all axes**.

##${prefix} onZeroAxisId(string|number)

When there are multiple axes, you can use this property to manually specify on which axis the 0 scale is.

#${prefix} label(Object)

Axis Label Configuration.

{{ use: component-axis-label(
  prefix = '#' + ${prefix}
) }}

##${prefix} flush(boolean) = false

The text at the beginning and end of the coordinate axis shrinks inward.

##${prefix} lastVisible(boolean)

**`sampling` Effective when turned on** Whether the last axis text is displayed. The default is automatically determined based on the label overlap policy.

##${prefix} autoRotate(boolean) = false

Axis label auto-rotation switch, off by default, **needs to be turned on manually, and `sampling` needs to be turned off**.

##${prefix} autoRotateAngle(array) = [0, 45, 90]

Effective only when `autoRotate` is true, optional rotation range, default is [0, 45, 90].

##${prefix} autoHide(boolean) = false

Axis label autohide switch, off by default, ** needs to be turned on manually, and `sampling` needs to be turned off**.

##${prefix} autoHideMethod('parity'|'greedy'|CustomMethod) = 'parity'

Effective only if `autoHide` is true, anti-overlap policy, defaults to 'parity'.

- 'parity': parity, using the strategy of removing all other labels (this works well for standard linear axes).
- 'greedy': a linear scan of the labels will be performed and all labels overlapping with the last visible label will be removed.
- The `CustomMethod` type can also be passed in as a function for customizing the policy.

```ts
export type CustomMethod = (items: IText[], separation: number) => IText[];
```

##${prefix} autoHideSeparation(number) = 0

Effective only when `autoHide` is true, sets the distance in px between texts.

##${prefix} autoLimit(boolean) = false

Axis label auto-truncation switch, off by default, **needs to be turned on manually, and `sampling` needs to be turned off**.

##${prefix} limitEllipsis(string) = '...'

Only works if `autoLimit` is true, omits placeholders, defaults to '...'. .

##${prefix} autoWrap(boolean) = false

Axis label automatic line wrapping is supported from version `1.12.5`.

It will not be effective when `autoRotate` is set to `true`. If autoRotate is enabled, the automatic rotation strategy will be used preferentially.

You can set the maximum number of line breaks through the `label.style.lineClamp` configuration item.

##${prefix} layoutFunc(function)

`sampling` takes effect when `sampling` is turned off, custom layout configurations, and if `layoutFunc` is declared, none of the anti-overlap related configurations (`autoHide`, `autoRotate`, `autoLimit`) provided by default take effect.

The function definition for this attribute is as follows:

```ts
  /**
   * :: Custom layout configurations, if `layoutFunc` is declared, the default anti-overlap related configurations (`autoHide`, `autoRotate`, `autoLimit`) will not take effect.
   * @param labels Label graphic elements
   * @param labelData labelData
   * @param layer The layer of the current axis.
   * @param axis Current axis component instance
   * @returns void
   */
  layoutFunc?: (labels: IText[], labelData: AxisItem[], layer: number, axis: IGroup) => void;
```

##${prefix} containerAlign(string)

Supported since `1.3.0` version, used to configure the alignment of the label relative to the overall coordinate axis container.

- `top`: overall upward alignment (vertical direction)
- `middle`: overall center alignment (vertical direction)
- `bottom`: overall downward alignment (vertical direction)
- `left`: overall left alignment (horizontal direction)
- `center`: overall center alignment (horizontal direction)
- `right`: Overall alignment to the right (horizontal direction)

#${prefix} title(Object)

Axis title configuration.

{{ use: component-axis-title(
  prefix = '#'+ ${prefix}
) }}

##${prefix} autoRotate(boolean) = true

If or not the title will be automatically rendered according to the axis direction, effective on the left and right vertical axes. The default is true, which means the left axis title is rotated by -90 degrees and the right axis title is rotated by 90 degrees.

**It is recommended to set this property to false if you need to configure the angle of the text separately in `textStyle`.**

##${prefix} inside(boolean) = false

Title orientation, defaults to outward (outside of the coordinate line enclosing the box).

#${prefix} background(Object)

Coordinate axis background configuration.

##${prefix} visible(boolean) = false

Whether or not to draw the axis background.

##${prefix} style(Object)

Axis background style settings.

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

The style of the title background in different interaction states, **it takes effect when hover/select interaction is enabled**, currently the axis supports the following four interaction states:

- 1. hover
- 2. hover_reverse
- 3. selected
- 4. selected_reverse

###${prefix} hover(Object)

The style configuration of the element when it is hovered.

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

###${prefix} hover_reverse(Object)

The style configuration of the other elements when they are hovered.

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected(Object)

The style configuration when the element is selected.

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected_reverse(Object)

The style configuration when other elements are selected.

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

#${prefix} grid(Object)

Gridline Configuration.

{{ use: component-axis-grid(
  prefix = '#' + ${prefix}
) }}

#${prefix} subGrid(Object)

Subgrid line configuration.

{{ use: component-axis-grid(
  prefix = '#' +${prefix}
) }}

#${prefix} mode('3d' | '2d')
Whether the axis component is a 3d mode axis component or not, the 3d mode axis component will have some changes compared to the 2d axis, for example, the tick line of the 3d axis will be oriented towards the window （note that there is a difference between this and the support3d configuration, which configures whether or not the 3d transform is applied to the graphic element in 3d mode, and its own shape will not change, whereas mode switching of the axes will make the (while switching the mode of an axis will cause the shape of the axis to change directly)

#${prefix} unit(Object)

Supported since version `1.5.1`. Axis unit configuration is only applicable to coordinate axes in the Cartesian coordinate system.

##${prefix} visible(boolean) = false

Whether to display axis units.

##${prefix} text(string|number)

Axis unit text.

##${prefix} style(Object)

Axis unit text style configuration.

Axis title style settings.

{{ use: graphic-text(
   prefix = '##' + ${prefix}
) }}

#${prefix} innerOffset(Object)

The inner indentation of the rectangular coordinate system axis can generate blank space inside the drawing area, which can avoid the scene where some graphics are truncated.

The upper and lower axes support the configuration of `left` and `right`, and the left and right axes support the configuration of `top` and `bottom`.

##${prefix} left(ILayoutNumber)

The left margin of the upper and lower axes.

{{ use: common-layout-number }}

##${prefix} right(ILayoutNumber)

The right margin of the upper and lower axes.

{{ use: common-layout-number }}

##${prefix} top(ILayoutNumber)

The top margin of the left and right axes.

{{ use: common-layout-number }}

##${prefix} bottom(ILayoutNumber)

The bottom margin of the left and right axes.

{{ use: common-layout-number }}
