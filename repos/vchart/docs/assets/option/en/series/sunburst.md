{{ target: series-sunburst }}

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  isHierarchy = true,
  seriesType = 'sunburst',
  seriesMarks = ['sunburst'],
  noMorph = ${noMorph},
  noStack = ${noStack},
  useInChart = ${useInChart},
  preset = 'growAngleIn' + '|' + 'growRadiusIn' + '|' + 'fadeIn',
  defaultPreset = 'growRadiusIn'
) }}

#${prefix} categoryField(string)

Category field.

#${prefix} valueField(string)

Weight field.

#${prefix} centerX(number)

Sunburst chart center point, x-coordinate, default at the center.

#${prefix} centerY(number)

Sunburst chart center point, y-coordinate, default at the center.

#${prefix} offsetX(number) = 0

Sunburst chart center point, x-coordinate offset.

#${prefix} offsetY(number) = 0

Sunburst chart center point, y-coordinate offset.

#${prefix} startAngle(number) = -90

Starting angle.

#${prefix} endAngle(number) = 270

Ending angle, default to fill the entire circle.

#${prefix} innerRadius(number) = 0

Sector inner radius, supports passing an array to configure the inner radius layer by layer.

#${prefix} outerRadius(number) = 1

Sector outer radius, supports passing an array to configure the outer radius layer by layer.

#${prefix} gap(number) = 0

Layer gap, supports passing an array to configure layer gaps layer by layer.

#${prefix} labelLayout(SunburstLabelConfig)

Label layout related parameters, supports passing an array to configure label layout styles layer by layer, passing null means no layout.

##${prefix} align(string)

Alignment, optional values:

- `'start'`: Start position
- `'end'`: End position
- `'center'`: Center

##${prefix} rotate(string)

Text rotation direction

- `'tangential'`: Tangential
- `'radial'`: Radial

##${prefix} offset(number)

Offset distance

#${prefix} labelAutoVisible(LabelAutoVisibleType)

Automatically hide dense labels, supports setting a circumference threshold, when the sector circumference is smaller than this value, the label is hidden.

##${prefix} enable(boolean) = false
Function enable switch

##${prefix} circumference(number) = 10
Circumference threshold, when the sector circumference is smaller than this value, the label is hidden. Default is 10 pixels.

<!-- Drill down -->

{{ use: common-drill(
  prefix = ${prefix}
) }}

<!-- Label Element -->

#${prefix} label(Object)

Label element configuration

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'label'
) }}

{{ use: mark-text(
  prefix = '##' + ${prefix}
)}}

##${prefix} state(Object)

{{ use: mark-state-style() }}

<!-- Sunburst Element -->

#${prefix} sunburst(Object)

Sunburst element configuration

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'sunburst'
) }}

{{ use: mark-arc(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}
