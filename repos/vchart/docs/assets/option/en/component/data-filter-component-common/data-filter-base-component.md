{{ target: component-data-filter-base }}

#${prefix} visible(boolean) = true

Whether to display the component.

#${prefix} orient(string) = 'left'

Component position.

Optional values:

- 'left'
- 'top'
- 'right'
- 'bottom'

#${prefix} width(string | number) = 'auto'

Component width.

#${prefix} height(string | number) = 'auto'

Component height.

#${prefix} field(string)

Declare the associated mapping field.

#${prefix} axisId(string)

Associated axis ID.

#${prefix} axisIndex(number)

Associated axis index.

#${prefix} regionId(string)

Associated region ID.

The component's associated region index intersects with the region associated with the axis

- Not configured: Defaults to the region controlled by the axis
- Configured: User-configured intersect with the region associated with the axis
- Configuration priority: regionIndex > regionId

#${prefix} regionIndex(number)

Associated region index.

The component's associated region index intersects with the region associated with the axis

- Not configured: Defaults to the region controlled by the axis
- Configured: User-configured intersect with the region associated with the axis
- Configuration priority: regionIndex > regionId

#${prefix} filterMode(string) = 'filter'

Data filtering mode.

Optional values:

- 'filter'
- 'axis'

When `filterMode` is set to `filter`, it means filtering multiple data, which will affect the scale calculation of the axis; when `filterMode` is set to `axis`, it only affects the coordinate corresponding range of the corresponding axis and does not filter the data.

#${prefix} start(number) = 0

Start configuration (percentage): Range [0, 1].

#${prefix} end(number) = 1

End configuration (percentage): Range [0, 1].

#${prefix} startValue(string | number)

Start data configuration: When not configured, it is converted according to start.

#${prefix} endValue(string | number)

End data configuration: When not configured, it is converted according to end.

#${prefix} rangeMode([string | string])

Start and end configuration modes: Only when the mode and configuration match does it take effect, such as rangeMode: ['percent', 'value'], then both start and endValue must be configured to take effect.

#${prefix} autoIndent(boolean)

Whether to automatically indent.


#${prefix} auto(boolean) = false

Whether it is in automatic mode. After opening, the component will not cause scaling of the axis, and configurations such as `end`、`roam`、`minSpan`、`maxSpan`、`minValueSpan`、`maxValueSpan` that may cause scaling will be ignored, and the component can automatically disappear. Supported since version `1.4.0`.

#${prefix} zoomLock(boolean) = false
Whether to lock the size of the selection area (or data window). Supported since version `1.5.1`.

#${prefix} minSpan(number) = 0
Minimum value used to limit window size, [0, 1]. Supported since version `1.5.1`.

#${prefix} maxSpan(number) = 1
The maximum value used to limit the window size, [0, 1]. Supported since version `1.5.1`.

#${prefix} minValueSpan(number)
The minimum data value used to limit the window size, only takes effect in continous scale, and has a higher priority than minSpan. Supported since version `1.5.1`.

#${prefix} maxValueSpan(number)
The maximum data value used to limit the window size, only takes effect in continous scale, and has priority higher than maxSpan. Supported since version `1.5.1`.

#${prefix} delayType(string)
Event trigger delay type, if not configured, it will be regarded as not enabled. Supported since version `1.5.1`.

Optional values:
- `'throttle'`: throttling
- `'debounce'`: anti-shake

#${prefix} delayTime(number) = 30
The event trigger delay time. Supported since version `1.5.1`.

#${prefix} roamZoom(boolean|object) = false
Roaming mode - zoom (free interaction within the canvas), not enabled by default. Supported since version `1.5.1`.

##${prefix} focus(boolean) = true
Whether to enable focus zoom. When turned on, the default starts from the mouse position; when turned off, zooms from the center of the canvas.

{{ use: roam-spec(
prefix = '#' + ${prefix}
) }}

#${prefix} roamDrag(boolean|object) = false
Roaming mode - dragging (free interaction within the canvas), not enabled by default. Supported since version `1.5.1`.

##${prefix} reverse(boolean) = true
Whether the drag direction is opposite to the scroll bar movement direction.

{{ use: roam-spec(
prefix = '#' + ${prefix}
) }}

#${prefix} roamScroll(boolean|object) = false
Roaming mode - scrolling (free interaction within the canvas), not enabled by default. Supported since version `1.5.1`.

##${prefix} reverse(boolean) = true
Whether the scroll direction is opposite to the scroll bar movement direction.

{{ use: roam-spec(
prefix = '#' + ${prefix}
) }}

#${prefix} realTime(boolean) = true
Whether to update the view in real time during interaction, enabled by default. Supported since version `1.5.1`.

### customDomain(array)

Supports custom domain, used to unify dataZoom domain and associated axis domain(When the brush component turns on `zoomAfterBrush`, the associated dataZoom needs to be consistent with the axis, otherwise the brush range cannot be calculated correctly.). Supported since version 1.10.0.

### updateDataAfterChange(Function)
Customize the callback when datazoom is updated. Supported since version 1.10.0.

```ts
/**
 * @params start dataZoom starting point
 * @params start dataZoom end point
 * @params startValue dataZoom starting point data value
 * @params endValue dataZoom end data value
 */
(start: number, end: number, startValue: any, endValue: any) => void
```

{{ use: common-layout-item(
  prefix = ${prefix},
  defaultLayoutType = 'region-relative',
  defaultLayoutLevel = 40,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}
