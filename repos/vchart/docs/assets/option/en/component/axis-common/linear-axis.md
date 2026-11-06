{{ target: component-linear-axis }}

<!-- ILinearAxisSpec -->

#${prefix} min(number)

**Applies only when the axis is a linear or time axis**. Minimum value(time axis only support timeStamp), **takes precedence over zero and nice**.

#${prefix} max(number)

**Applies only when the axis is a linear or time axis**. Maximum value(time axis only support timeStamp), **takes precedence over zero and nice**.

#${prefix} softMin(number)

Supported since version **1.11.0**

Only effective when the axis is a linear or time axis, minimum value (time axis only supports timestamps), only takes effect when this value is less than the minimum data value, **takes precedence over zero and nice**.

- Note: Not recommended to use together with configuring `min`

#${prefix} softMax(number)

Supported since version **1.11.0**

Only effective when the axis is a linear or time axis, maximum value (time axis only supports timestamps), only takes effect when this value is greater than the maximum data value, **takes precedence over zero and nice**.

Note: Not recommended to use together with configuring `max`

#${prefix} nice(boolean) = true

**Applies only when the axis is a linear or time axis**. Whether to adjust the axis range to a relatively neat value based on the data. When `min` and `max` are configured, this option is invalid.

For example, when `max = 999`, `nice` will not optimize the axis range to 1000.

#${prefix} niceType(string) = 'tickCountFirst'

**Applies only when the axis is a linear or time axis**. The type of nice effect, either accuracy-first or tickCount-first (e.g., if tickCount is 2, the nice precision is very low). If not configured, the default is tickCountFirst.

Optional values:

- `'tickCountFirst'`
- `'accurateFirst'`

Example: If the data range is 0~6000 and the tickCount is 2, the `tickCountFirst` range will be [0, 10000], while the `accurateFirst` range will be [0, 6000], but 10000 will not be displayed.

#${prefix} zero(boolean) = true

**Applies only when the axis is a linear or time axis**. Whether to include 0 value. When min and max are configured, this option is invalid.

#${prefix} expand(Object)

**Applies only when the axis is a linear or time axis**. The axis range expands proportionally, and when min and max are configured, this option is invalid.

##${prefix} min(number)

Minimum value of axis range expanded proportionally.

##${prefix} max(number)

Maximum value of axis range expanded proportionally.

#${prefix} sync(Object)

Synchronize the current axis with other axes

##${prefix} axisId(number)

The id of the other axis to sync

##${prefix} zeroAlign(number)

Keep the 0 values of the 2 axes aligned

##${prefix} tickAlign(number)

Make this axis' ticks proportionally aligned with the target axis

#${prefix} tooltipFilterRange(number | [number, number])

**Applies only when the axis is a linear or time axis**. Configure the dimension tooltip data filtering range on the linear axis. Supported since version 1.4.0.

If configured as a single number such as `d`, the filtering interval is `[x0 - d, x0 + d]`. If configured as a binary tuple such as `[d1, d2]`, the filtering interval is `[x0 + d1, x0 + d2]`.

#${prefix} breaks(Array|Object)

Supported since `1.12.4` version.

Axis truncation configuration, only valid for linear axis of Cartesian coordinate system.

##${prefix} range(number[])

Data range of axis truncation, such as `[300, 500]`, please ensure the size order of the data range, otherwise it will be considered as invalid configuration.

##${prefix} breakSymbol(Object)

Truncation graphic style configuration.

###${prefix} visible(boolean)

Whether to display, the default is `true`.

###${prefix} gap(number | string)

Gap configuration between truncation marks, the default is `6`.

- 1. `number` is pixel value
- 2. `string` is percentage relative value, such as '1%'

###${prefix} angle(number)

Truncation graphic rotation angle configuration.

###${prefix} style(Object)

The style configuration of the truncation graphic, you can configure the line width (`lineWidth`), color (`stroke`), etc.
