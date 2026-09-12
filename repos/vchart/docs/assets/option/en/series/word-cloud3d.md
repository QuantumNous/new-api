{{ target: series-word-cloud3d }}

<!-- IWordCloudSeriesSpec -->

**wordCloud3d series**, used for drawing 3d word cloud chart. **Only applies to Cartesian coordinate system**.

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'wordCloud',
  seriesMarks = ['word'],
) }}

#${prefix} nameField(string)

Text field.

#${prefix} valueField(string)

Weight field.

#${prefix} fontFamilyField(string)

Font field.

#${prefix} fontWeightField(string)

Font weight field.

#${prefix} fontStyleField(string)

Font style field.

#${prefix} colorHexField(string)

Specify hex color field directly.

#${prefix} colorMode(string)

Color mode.

Optional values:

<!-- - `'linear'`: Linear coloring (to be opened) -->

- `'ordinal'`: Ordinal coloring

#${prefix} colorList(Array)

Color list.

#${prefix} rotateAngles(Array)

Rotatable angle random range list.

#${prefix} fontWeightRange(Array)

Font weight range. If you need a fixed font weight, configure the numbers in the array to be the same.

#${prefix} fontSizeRange(Array|string)

Font size range. If you need a fixed font size, configure the numbers in the array to be the same.

When valueField exists, the default value is [20,40]; When valueField does not exist, the default value is [10, 10].

'auto' configuration is supported since version 1.8.7. That is, if the configuration is 'auto', fontSizeRange is not passed in, and the font size will change as the canvas size changes.

#${prefix} maskShape(string)

Word cloud shape, url, or svg string or base64, or built-in string (svg string and base64 not yet supported).

Built-in string optional values:

- `'triangleForward'`: Right arrow
- `'triangle'`: Triangle
- `'diamond'`: Diamond
- `'square'`: Square
- `'star'`: Star
- `'cardioid'`: Heart
- `'circle'`: Circle
- `'pentagon'`: Pentagon
- `'rect'`: Rect (supported since 1.9.3)

#${prefix} random(boolean)

Whether to start random placement direction (clockwise or counterclockwise).

#${prefix} wordCloudConfig(Object)

Word cloud special configuration (only takes effect when the maskShape of the word cloud is not specified or maskShape is a shape string).

##${prefix} drawOutOfBound(string) = 'hidden'

Omitted strategy for extra-long text, beyond the canvas.

Optional values:

- `'clip'`: Draw extra-long text, cropping the part beyond the canvas
- `'hidden'`: Do not draw extra-long text
- `'ellipsis'`: Draw extra-long text and use the user-specified string to replace the text that is out of range (not yet supported)

##${prefix} ellipsis(Object)

Omitted text configuration.

###${prefix} string(string) = '...'

Extra-long text replacement string.

###${prefix} limitLength(number) = '...'

Limited length, displaying the user-specified string for parts exceeding this length.

##${prefix} zoomToFit(Object)

Adaptive zoom configuration.

###${prefix} shrink(boolean)

Whether to shrink.

###${prefix} enlarge(boolean)

Whether to enlarge.

###${prefix} fontSizeLimitMin(number)

Minimum font size when shrinking, shrink: true takes effect.

###${prefix} fontSizeLimitMax(number)

Maximum font size when enlarging, enlarge: true takes effect.

##${prefix} layoutMode(string)

Layout mode.

Optional values:

- `'fast'`: Fast layout, for Mini Programs & Applets environment
- `'grid'`: Based on grid pixel layout
- `'default'`: Based on pixel layout

##${prefix} progressiveTime(number)

Progressive rendering configuration - layout time.

##${prefix} progressiveStep(number)

Progressive rendering configuration - layout count.

#${prefix} wordCloudShapeConfig(Object)

Word cloud special configuration (only takes effect when the maskShape of the word cloud is url, base64, or svg string).

##${prefix} fillingColorList(Array)

Fill word - color channel.

##${prefix} fillingColorList(Array)

Fill word - color list.

##${prefix} fillingFontFamilyField(string)

Fill word - font field.

##${prefix} fillingFontWeightField(string)

Fill word - font weight field.

##${prefix} fillingFontStyleField(string)

Fill word - font style field.

##${prefix} fillingColorHexField(string)

Fill word - directly specify the hex color field.

##${prefix} fillingRotateAngles(Array)

Fill word - rotatable angle random range list.

##${prefix} ratio(number)

Overall layout - expected ratio when automatically calculating core words.

##${prefix} removeWhiteBorder(boolean)

Overall layout - whether to remove the white border from the input image.

##${prefix} layoutMode(string)

Overall layout - layout mode.

Optional values:

- `'default'`
- `'ensureMapping'`
- `'ensureMappingEnlarge'`

##${prefix} fillingTimes(number)

Fill layout - number of times to fill in the words.

##${prefix} fillingXStep(number)

Fill layout - fill advance range for x.

##${prefix} fillingYStep(number)

Fill layout - fill advance range for y.

##${prefix} fillingXRatioStep(number)

Fill layout - fill advance range for x (relative width ratio).

##${prefix} fillingYRatioStep(number)

Fill layout - fill advance range for y (relative height ratio).

##${prefix} fillingInitialFontSize(number)

Fill layout - initial font size of filled words.

##${prefix} fillingDeltaFontSize(number)

Fill layout - font size reduction value for each time the word is filled.

##${prefix} fillingInitialOpacity(number)

Fill layout - initial opacity of filled words.

##${prefix} fillingDeltaOpacity(number)

Fill layout - opacity reduction value for each time the word is filled.

##${prefix} textLayoutTimes(number)

Fill layout - number of times a word attempts to layout.

##${prefix} fontSizeShrinkFactor(number)

Fill layout - factor for shrinking the font size after each layout failure.

##${prefix} stepFactor(number)

Fill layout - layout step factor.

##${prefix} importantWordCount(number)

Fill layout - number of important words.

##${prefix} globalShinkLimit(number)

Fill layout - font size shrinkage limit.

##${prefix} fontSizeEnlargeFactor(number)

Fill layout - factor for enlarging the font size after each layout success.

##${prefix} fillingDeltaFontSizeFactor(number)

Fill layout - the factor by which the font size of fill words is reduced after each iteration when the font size of fill words is automatically calculated.

##${prefix} fillingRatio(number)

Fill layout - expected ratio when automatically calculating filling words.

#${prefix} word(Object)

Word cloud text element configuration or shape word cloud core word text element configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} padding(number)

Text spacing.

##${prefix} formatMethod(Function)

Text formatting callback function.

{{ use:text-format-callback(
  description = 'text'
) }}

##${prefix} style(Object)

Text style.

{{ use: mark-style(
  markName = 'word'
) }}

{{ use: mark-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} fillingWord(Object)

Shape word cloud filling word text element configuration.

The reason for not adding formatMethod: In the layout of shape word cloud, word and fillingWord use the same data, that is, the text is the same, so the format of fillingWords will not take effect.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} padding(number)

Text spacing.

##${prefix} style(Object)

Text style.

{{ use: mark-style(
  markName = 'fillingWord'
) }}

{{ use: mark-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} depth_3d(number)
3d word cloud center point depth size relative to the screen
