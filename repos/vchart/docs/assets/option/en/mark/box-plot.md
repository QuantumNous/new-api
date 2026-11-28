{{ target: mark-box-plot }}

<!-- IBoxPlotMarkSpec -->

#${prefix} shaftShape(string) = 'line'
The rendering shape of the box plot, controlling its visual presentation

Optional values:

- `'line'` - Standard line form with rectangular box and line whiskers
- `'bar'` - Bar form using rectangles to represent data ranges
- `'filled-line'` - Filled line form

#${prefix} boxWidth(number|string)
The width of the box (for vertical box plot) or height (for horizontal box plot)

Supports numbers or percentage strings. Adaptive to group width when empty.

Default: `30`

#${prefix} boxHeight(number|string)
The height of the box (for vertical box plot) or width (for horizontal box plot)

Supports numbers or percentage strings.

#${prefix} shaftWidth(number|string)
The width of whisker caps (for vertical box plot) or height (for horizontal box plot)

Supports numbers or percentage strings. Adaptive when empty. Only effective when `shaftShape='line'` or `'filled-line'`.

Default: `20`

#${prefix} ruleWidth(number|string)
The width of whisker cap lines (for vertical box plot) or height (for horizontal box plot)

Only effective when `shaftShape='line'` or `'filled-line'`.

#${prefix} ruleHeight(number|string)
The height of whisker cap lines (for vertical box plot) or width (for horizontal box plot)

Only effective when `shaftShape='line'` or `'filled-line'`.

#${prefix} minMaxWidth(number|string)
The following configurations only take effect when `shaftShape='bar'`.
The width of the min-max rectangle (for vertical box plot) or height (for horizontal box plot)

#${prefix} minMaxHeight(number|string)
The height of the min-max rectangle (for vertical box plot) or width (for horizontal box plot)

#${prefix} q1q3Width(number|string)
The width of the Q1-Q3 quartile rectangle (for vertical box plot) or height (for horizontal box plot)

#${prefix} q1q3Height(number|string)
The height of the Q1-Q3 quartile rectangle (for vertical box plot) or width (for horizontal box plot)

#${prefix} lineWidth(number) = 2
The stroke width of the box plot

Affects all line widths in `shaftShape='line'` or `'filled-line'` mode.
No stroke is displayed in `shaftShape='bar'` mode.

#${prefix} stroke(string)
The stroke color of the box plot

#${prefix} boxStroke(string)
The stroke color of the box, can be set separately to distinguish from other parts

{{ use: common-version(version: '2.0.11') }}

#${prefix} medianStroke(string)
The stroke color of the median line, can be set separately to highlight the median

{{ use: common-version(version: '2.0.11') }}

#${prefix} boxFill(string)
The fill color of the box, no fill if empty

#${prefix} minMaxFillOpacity(number)
The fill opacity of the min-max rectangle

Only effective when `shaftShape='bar'`.

#${prefix} boxCornerRadius(number)
The corner radius of the box, rounded corners will be displayed when set

{{ use: common-version(version: '2.0.11') }}

#${prefix} min(Function)
Data mapping function for minimum value

Type: `(datum: Datum) => number`

#${prefix} q1(Function)
Data mapping function for first quartile (Q1, 25th percentile)

Type: `(datum: Datum) => number`

#${prefix} median(Function)
Data mapping function for median (Q2, 50th percentile)

Type: `(datum: Datum) => number`

#${prefix} q3(Function)
Data mapping function for third quartile (Q3, 75th percentile)

Type: `(datum: Datum) => number`

#${prefix} max(Function)
Data mapping function for maximum value

Type: `(datum: Datum) => number`
