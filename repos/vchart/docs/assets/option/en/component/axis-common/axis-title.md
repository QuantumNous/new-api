{{ target: component-axis-title }}

<!-- ITitle -->

Axis title configuration.

#${prefix} visible(boolean) = false

Whether to display the axis title.

#${prefix} type(string)

Supported since version 1.7.0, text type.

Optional:

- 'text'
- 'rich'

#${prefix} text(string|number|(string|number)[])

Text content of the title.
Starting from version 1.7.0, rich text content is supported

#${prefix} position(string)

Optional parameters:

- `'middle'`
- `'start'`
- `'end'`

Display position of the title.

- Default for Cartesian coordinate system is 'middle'.
- For a polar coordinate system with a configured inner radius, default is 'middle'; otherwise, 'end'.

#${prefix} space(number)

Distance between the title and the coordinate axis (the enclosing box formed by the axis line, ticks, and labels).

#${prefix} padding(number|number[]|Object)

Title padding configuration.

{{ use: common-padding(
  componentName = 'Axis title'
) }}

#${prefix} angle(number)

Overall rotation angle of the title (if the title is configured with background, shape, and other attributes, use this attribute for overall rotation configuration).

#${prefix} style(Object)

Axis title style settings.

{{ use: graphic-text(
  prefix = '#' + ${prefix}
) }}

#${prefix} state(Object)

Axis title style configuration in different interaction states, **effective when the coordinate axis enables hover/select interaction**. Currently, the coordinate axis supports the following four interaction states:

- 1.  hover
- 2.  hover_reverse
- 3.  selected
- 4.  selected_reverse

##${prefix} hover(Object)

Style configuration when the element is hovered.

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} hover_reverse(Object)

Style configuration when other elements are hovered.

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} selected(Object)

Style configuration when the element is selected.

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} selected_reverse(Object)

Style configuration when other elements are selected.

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

#${prefix} background(Object)

Title background settings.

##${prefix} visible(boolean) = false

Whether to draw the title background.

##${prefix} style(Object)

Title background style settings.

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

Title background style configuration in different interaction states, **effective when the coordinate axis enables hover/select interaction**. Currently, the coordinate axis supports the following four interaction states:

- 1.  hover
- 2.  hover_reverse
- 3.  selected
- 4.  selected_reverse

###${prefix} hover(Object)

Style configuration when the element is hovered.

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

###${prefix} hover_reverse(Object)

Style configuration when other elements are hovered.

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected(Object)

Style configuration when the element is selected.

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected_reverse(Object)

Style configuration when other elements are selected.

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

#${prefix} shape(Object)

Title inner marker configuration.

##${prefix} visible(boolean) = false

Whether to draw the title marker.

##${prefix} space(number)

Spacing between the shape and the title text.

##${prefix} style(Object)

Title marker style settings.

{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

Title marker style configuration in different interaction states, **effective when the coordinate axis enables hover/select interaction**. Currently, the coordinate axis supports the following four interaction states:

- 1.  hover
- 2.  hover_reverse
- 3.  selected
- 4.  selected_reverse

###${prefix} hover(Object)

Style configuration when the element is hovered.

{{ use: graphic-symbol(
  prefix = '###' + ${prefix}
) }}

###${prefix} hover_reverse(Object)

Style configuration when other elements are hovered.

{{ use: graphic-symbol(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected(Object)

Style configuration when the element is selected.

{{ use: graphic-symbol(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected_reverse(Object)

Style configuration when other elements are selected.

{{ use: graphic-symbol(
  prefix = '###' + ${prefix}
) }}
