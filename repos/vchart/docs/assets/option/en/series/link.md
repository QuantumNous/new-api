{{ target: series-link }}

<!-- ILinkSeriesSpec -->

**link series**, can be used to draw time series charts, need to be used in conjunction with dot series. **Only applicable to Cartesian coordinates**.

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'link',
) }}

#${prefix} fromField(string)

The starting point field, used to draw the starting point of the link.
Note: The data provided by this field should be consistent with the data provided by the nameField field in the associated dot series, and the positioning of the starting point follows the nodes of the dot series.

#${prefix} toField(string)
The ending point field, used to draw the ending point of the link.
Note: The data provided by this field should be consistent with the data provided by the nameField field in the associated dot series, and the positioning of the ending point follows the nodes of the dot series.

#${prefix} dotSeriesIndex(number)

The associated dot series index.

#${prefix} dotTypeField(string)

The associated event type. It is used to distinguish the stroke logic of the link. If it is not configured, each link will use the same stroke.

#${prefix} link(Object)
Line graphic style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'link'
) }}

{{ use: mark-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} arrow(Object)

Arrow graphic style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'arrow'
) }}

{{ use: mark-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}