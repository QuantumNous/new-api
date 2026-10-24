{{ target: series-rose }}

<!-- IRadarSeriesSpec -->

**Rose series**, for drawing rose charts. **Only applicable to polar coordinates**.

{{ use: common-polar-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'rose',
  seriesMarks = ['rose'],
  noInvalidType = true,
  preset = 'growAngle' + '|' + 'growRadius' + '|' + 'fadeIn',
  defaultPreset = 'growRadius'
) }}

#${prefix} rose(Object)

Rose chart element style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'arc'
) }}

{{ use: mark-arc(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} label(Object)

Label configuration.

{{ use: component-label(
  prefix = '#' + ${prefix},
) }}

##${prefix} position(string)

Supported since version `1.3.0`, label layout method.
The default value is `'outside'`.

Optional values:

- `'outside'`
- `'inside'`
- `'inside-outer'`
- `'inside-inner'`

##${prefix} offsetRadius(number)

Supported since version 1.4.2. The radial offset value of the label from the outer or inner radius.

If `position` is set to `'inside-outer'`, it is relative to the outer radius; if `position` is set to `'inside-inner'`, it is relative to the inner radius.

##${prefix} coverEnable(boolean)

Allow label overlapping.
The default value is `false`.

##${prefix} rotate(boolean)

Allow label rotation.
The default value is `true`.

##${prefix} spaceWidth(number)

Text and guide line spacing width.
The default value is `5`.

##${prefix} layoutArcGap(number)

Gap between sector labels.
The default value is `6`.

##${prefix} line(Object)

Label guide line style.

###${prefix} visible(boolean)

Display guide line.
The default value is `true`.

###${prefix} line1MinLength(number)

Guide line line1 part minimum length.
The default value is `20`.

###${prefix} line2MinLength(number)

Guide line line2 part minimum length.
The default value is `10`.

###${prefix} smooth(boolean)

Whether the guide line is smooth.
The default value is `false`.
Supported since version 1.4.0.

{{ use: common-mark(
  prefix = '##' + ${prefix}
) }}

###${prefix} style(Object)

Guide line style.

{{ use: mark-style(
  markName = 'line'
) }}

{{ use: mark-path(
  prefix = '###' + ${prefix}
) }}

###${prefix} state(Object)

{{ use: mark-state-style() }}

##${prefix} layout(Object)

Label layout configuration.

###${prefix} align(string)

Label alignment mode.
The default value is `'arc'`.

Optional values:

- `'arc'`
- `'labelLine'`
- `'edge'`

###${prefix} strategy(string)

Label layout strategy.
The default value is `'priority'`.

Optional values:

- `'priority'`
- `'vertical'`
- `'none'`

###${prefix} tangentConstraint(boolean)

Enable tangent constraint.
The default value is `true`.
