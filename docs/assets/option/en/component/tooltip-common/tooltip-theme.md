{{ target: component-tooltip-theme }}

<!-- ITooltipTheme -->

#${prefix} panel(Object)

Configure tooltip background frame style.

##${prefix} padding(Object)

{{ use: common-padding(
  prefix = '#' + ${prefix},
  componentName = 'tooltip background frame'
) }}

##${prefix} backgroundColor(string)

**Optional** Configure background color.

##${prefix} border(Object)

**Optional** Configure background frame border.

###${prefix} color(string)

**Optional** Configure background frame border color.

###${prefix} width(number)

**Optional** Configure background frame border width.

###${prefix} radius(number)

**Optional** Configure background frame border radius.

##${prefix} shadow(Object)

**Optional** Configure background frame shadow.

###${prefix} x(number)

**Optional** Configure background frame shadow offset x.

###${prefix} y(number)

**Optional** Configure background frame shadow offset y.

###${prefix} blur(number)

**Optional** Configure background frame shadow blur radius.

###${prefix} spread(number)

**Optional** Configure background frame shadow spread radius.

###${prefix} color(string)

**Optional** Configure background frame shadow color.

#${prefix} shape(Object)

**Optional** Configure tooltip shape style.

##${prefix} size(number)

**Optional** Configure tooltip shape width and height. This configuration is common to `shapeSize`.

##${prefix} spacing(number)

**Optional** Configure tooltip shape horizontal spacing with adjacent element on the right.

{{ use: component-tooltip-shape-pattern(
  prefix = '#' + ${prefix},
  type = 'style'
) }}

#${prefix} titleLabel(Object)

**Optional** Configure tooltip title row style.

{{ use: component-tooltip-text-theme(
  prefix = '#' + ${prefix},
  componentName = 'tooltip title row',
  labelType = 'title',
  spacing = false
) }}

#${prefix} keyLabel(Object)

**Optional** Configure tooltip content row key column style.

{{ use: component-tooltip-text-theme(
  prefix = '#' + ${prefix},
  componentName = 'tooltip content row key column',
  labelType = 'key',
  spacing = true
) }}

#${prefix} valueLabel(Object)

**Optional** Configure tooltip content row value column style.

{{ use: component-tooltip-text-theme(
  prefix = '#' + ${prefix},
  componentName = 'tooltip content row value column',
  labelType = 'value',
  spacing = true
) }}

#${prefix} spaceRow(number)

**Optional** Configure tooltip content row spacing.

#${prefix} maxContentHeight(number)

**Optional** Configure the maximum height of the content area, and if the content area exceeds this height, a local scrollbar will be displayed (applicable to dom tooltip). Supported since version 1.9.0.

#${prefix} align('left' | 'right')

Supported since version 1.11.5.

**Optional** Set the content alignment:

- 'left': shape, title, and values are displayed from left to right, aligned to the left
- 'right': shape, title, and values are displayed from right to left, aligned to the right
