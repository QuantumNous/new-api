{{ target: series-box-plot }}

<!-- IBoxPlotSeriesSpec -->

**Box Plot Series**, can be used to draw box plots. **Only applicable to Cartesian coordinate systems**.

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  noStack = true,
  noInvalidType = true,
  useInChart = ${useInChart},
  seriesType = 'boxPlot',
  seriesMarks = ['boxPlot', 'symbol'],
  noPreset = true
) }}

#${prefix} minField(string)

The minimum value field of the box plot.

#${prefix} q1Field(string)

The Q1 (lower quartile, also known as the "smaller quartile", equal to the 25% number in the sample when all values are sorted from smallest to largest) field of the box plot. If q1Field and q3Field are both empty, the box body will not be drawn.

#${prefix} medianField(string)

The median field (Q2) of the box plot (equal to the 50% number in the sample when all values are sorted from smallest to largest). If empty, the median mark on the box body will not be drawn.

#${prefix} q3Field(string)

The Q3 (upper quartile, also known as the "larger quartile", equal to the 75% number in the sample when all values are sorted from smallest to largest) field of the box plot. If q1Field and q3Field are both empty, the box body will not be drawn.

#${prefix} maxField(string)

The maximum value field of the box plot.

#${prefix} outliersField(string)

The outliers field of the box plot.

#${prefix} boxPlot(Object)

The box plot graphic style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)
The box plot graphic style configuration.
{{ use: mark-box-plot(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} outliersStyle(Object)
The style configuration of the outliers in the box plot.

##${prefix} fill(string)
The fill color of the outliers, if empty, it will follow the box plot color.

##${prefix} size(number) = 10
The size of the outliers.
