{{ target: series-funnel }}

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  seriesType = 'funnel',
  seriesMarks = ['funnel'],
  noMorph = ${noMorph},
  noStack = ${noStack},
  useInChart = ${useInChart},
  preset = 'clipIn' + '|' + 'fadeIn',
  defaultPreset = 'clipIn'
) }}

#${prefix} categoryField(string)
Category field

#${prefix} valueField(string)
Value field

#${prefix} funnelOrient(string) = 'top'
Funnel chart orientation. Default is 'top'

Options：

- `'left'`
- `'top'`
- `'right'`
- `'bottom'`

#${prefix} funnelAlign(string) = 'center'
Funnel chart alignment. Default is 'center'

Options：

- `'left'`
- `'center'`
- `'right'`

#${prefix} heightRatio(number) = 0.5
The height ratio between the funnel graphic and the transform graphic. Only effective when `isTransform: true`.
Supported since version `1.10.2`

#${prefix} shape(string) = 'trapezoid'
Funnel chart shape. Default is trapezoid 'trapezoid'

Options：

- `'trapezoid'`
- `'rect'`

#${prefix} isTransform(boolean) = false
If it's a conversion funnel chart.

#${prefix} isCone(boolean) = true
Whether the bottom of the funnel chart is sharp. It doesn't work when shape is `rect`

#${prefix} gap(number) = 0
The pixel gap between the funnel layers.

#${prefix} maxSize(number|string) = '80%'
The maximum width of the funnel chart, supports pixel values and percentage strings.

#${prefix} minSize(number|string) = 0
The minimum width of the funnel chart, supports pixel values and percentage strings.

#${prefix} funnel(Object)
Funnel layer graphic style settings.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'funnel'
) }}

{{ use: mark-polygon(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} transform(Object)
Conversion layer style settings.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'transform'
) }}

{{ use: mark-polygon(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} label(Object)
Label configuration.

##${prefix} limit(number|'shapeSize')
Text length limit

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}

#${prefix} transformLabel(Object)
Conversion layer label configuration.

##${prefix} limit(number|'shapeSize')
Text length limit

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}

#${prefix} outerLabel(Object)
Funnel layer external label configuration.

##${prefix} position('left'|'right'|'top'|'bottom') = 'left'
The default position for the funnel layer external label.
When funnelOrient is 'top' or 'bottom', position can be set to 'left' or 'right', default is 'left'.
When funnelOrient is 'left' or 'right', position can be set to 'top' or 'bottom', default is 'bottom'.

##${prefix} alignLabel(boolean) = true
Whether the text is aligned.

##${prefix} spaceWidth(number) = 5
The spacing between text and guide line, default is 5px.

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}

##${prefix} line(Object)
Guide line style settings.

###${prefix} minLength(number) = 20
Min length of guide line. Default is 20px. Supported since version `1.12.7`

###${prefix} style(Object)

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} transformRatioText(String)

Supported since version `1.13.6`, the built-in tooltip text for the funnel chart conversion layer is set to Chinese by default.
