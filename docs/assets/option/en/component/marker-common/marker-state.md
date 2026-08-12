{{ target: component-marker-state }}

#${prefix} state(Object)
Supported since `1.11.0` version, annotate the interaction state configuration of components.
The label line currently has the following four states. You can configure the line style after these interactive states are triggered.

- `'hover'`: hover state
- `'hover_reverse'`: non-hover state
- `'selected'`: selected state
- `'selected_reverse'`: unselected state

##${prefix} hover(Object)
hover state。

{{ if: ${graphicType} === 'line' }}
{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'polygon' }}
{{ use: graphic-polygon(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'symbol' }}
{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'image' }}
{{ use: graphic-image(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'richText' }}
{{ use: graphic-rich-text(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'rect' }}
{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'text' }}
{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'all' }}
{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}
{{ use: graphic-rich-text(
  prefix = '##' + ${prefix}
) }}
{{ use: graphic-image(
  prefix = '##' + ${prefix}
) }}
{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

##${prefix} hover_reverse(Object)
非 hover state。

{{ use: component-marker-style-callback(
  description = 'unHover state of annotation style supports callback'
) }}

{{ if: ${graphicType} === 'line' }}
{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'polygon' }}
{{ use: graphic-polygon(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'symbol' }}
{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'image' }}
{{ use: graphic-image(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'richText' }}
{{ use: graphic-rich-text(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'rect' }}
{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'text' }}
{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}
{{ /if }}
{{ if: ${graphicType} === 'all' }}
{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}
{{ use: graphic-rich-text(
  prefix = '##' + ${prefix}
) }}
{{ use: graphic-image(
  prefix = '##' + ${prefix}
) }}
{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

##${prefix} selected(Object)
selected state

{{ use: component-marker-style-callback(
  description = 'selected state of annotation style supports callback'
) }}

{{ if: ${graphicType} === 'line' }}
{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'polygon' }}
{{ use: graphic-polygon(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'symbol' }}
{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'image' }}
{{ use: graphic-image(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'richText' }}
{{ use: graphic-rich-text(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'rect' }}
{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'text' }}
{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'all' }}
{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}
{{ use: graphic-rich-text(
  prefix = '##' + ${prefix}
) }}
{{ use: graphic-image(
  prefix = '##' + ${prefix}
) }}
{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

##${prefix} selected_reverse(Object)
unSelected state

{{ use: component-marker-style-callback(
  description = 'unSelected state of annotation style supports callback'
) }}

{{ if: ${graphicType} === 'line' }}
{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'polygon' }}
{{ use: graphic-polygon(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'symbol' }}
{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'image' }}
{{ use: graphic-image(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'richText' }}
{{ use: graphic-rich-text(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'rect' }}
{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}
{{ /if }}

{{ if: ${graphicType} === 'text' }}
{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}
{{ /if }}
{{ if: ${graphicType} === 'all' }}
{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}
{{ use: graphic-rich-text(
  prefix = '##' + ${prefix}
) }}
{{ use: graphic-image(
  prefix = '##' + ${prefix}
) }}
{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}
{{ /if }}
