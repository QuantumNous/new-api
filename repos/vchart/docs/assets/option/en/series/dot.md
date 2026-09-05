{{ target: series-dot }}

<!-- IDotSeriesSpec -->

**dot series**, can be used to draw time series charts. **Only applicable to Cartesian coordinate system**.

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'dot',
  noPreset = true
) }}

#${prefix} seriesGroupField(string)

The series group field is used to distinguish the filling and stroke logic of grid and symbol in the series. If not configured, it will follow the yField field by default.

#${prefix} dotTypeField(string)
dot type field, used to distinguish the filling logic of dots.

#${prefix} titleField(string)
title type field, used to display title. If not configured, it will follow the yField field by default.

#${prefix} subTitleField(string)
subTitle type field, used to display subTitle. If not configured, it will follow the yField field by default.

#${prefix} highLightSeriesGroup(string)
Highlight group configuration, used to highlight a specific type of series group.

#${prefix} name(string)
name field, used to mark the name of the point, which is convenient for drawing edge series (link series).

#${prefix} dot(Object)
dot element style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'dot'
) }}

{{ use: mark-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} title(Object)
Title style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} visible(boolean)
Title visibility configuration.

##${prefix} formatMethod(Function)

Title text formatting configuration, configured in the form of a callback function.

{{ use:text-format-callback(
  description = 'Title'
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'title'
) }}

{{ use: mark-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} subTitle(Object)
Subtitle style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} visible(boolean)
Subtitle visibility configuration.

##${prefix} formatMethod(Function)

Subtitle text formatting configuration, configured in the form of a callback function.

{{ use:text-format-callback(
  description = 'Subtitle'
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'subTitle'
) }}

{{ use: mark-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} symbol(Object)
Symbol element style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'symbol'
) }}

{{ use: mark-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} grid(Object)
Line style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} visible(boolean)
Line visibility configuration.

##${prefix} background(Object)

Line background color (effective only when this series group is highlighted)

###${prefix} fill(string)
Background color.

###${prefix} fillOpacity(number)
Background color transparency.

{{ use:text-format-callback(
  description = 'Line'
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'grid'
) }}

{{ use: mark-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} leftAppendPadding(number)
Left margin of the dot series (mainly used to place title and subTitle).

#${prefix} clipHeight(number)
The visible height of the dot series, and the part beyond the visible height can be displayed by scrolling the mouse.