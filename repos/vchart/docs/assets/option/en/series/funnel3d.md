{{ target: series-funnel3d }}

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
Funnel chart orientation. Defaults to 'top'

Optional values:

- `'left'`
- `'top'`
- `'right'`
- `'bottom'`

#${prefix} funnelAlign(string) = 'center'
Funnel chart alignment. Defaults to 'center'

Optional values:

- `'left'`
- `'center'`
- `'right'`

#${prefix} shape(string) = 'trapezoid'
Funnel chart shape. Defaults to trapezoid 'trapezoid'

Optional values:

- `'trapezoid'`
- `'rect'`

#${prefix} isTransform(boolean) = false
Is it a transformational funnel chart?

#${prefix} isCone(boolean) = true
Is the bottom layer of the funnel chart sharp? Not effective when shape is `rect`.

#${prefix} gap(number) = 0
The pixel gap between funnel layers.

#${prefix} maxSize(number|string) = '80%'
Maximum width of the funnel chart, supports pixel values and percentage strings.

#${prefix} minSize(number|string) = 0
Minimum width of the funnel chart, supports pixel values and percentage strings.

#${prefix} funnel3d(Object)
Funnel layer graphic style setting.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'funnel3d'
) }}

{{ use: mark-polygon(
  prefix = '##' + ${prefix}
) }}

###${prefix} face(boolean[])
Due to some problems with 3D funnel at certain angles (canvas2d has difficulty with accurate depth testing), it is configured through `boolean[]` which faces can be displayed, and the order in the array is `top, bottom, left, right, front, back`.

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} transform(Object)
Transformation layer style settings.

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
Transformation layer label configuration.

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
Default position for funnel layer external label.
When funnelOrient is 'top' or 'bottom', position can be set to 'left' or 'right', default is 'left'.
When funnelOrient is 'left' or 'right', position can be set to 'top' or 'bottom', default is 'bottom'.

##${prefix} alignLabel(boolean) = true
Whether the text is aligned.

##${prefix} spaceWidth(number) = 5
The space between the text and the guideline, default is 5px.

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}

##${prefix} line(Object)
Guideline style settings.

###${prefix} style(Object)

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} state(Object)

{{ use: mark-state-style() }}
