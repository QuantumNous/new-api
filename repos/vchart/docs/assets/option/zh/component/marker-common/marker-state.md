{{ target: component-marker-state }}

#${prefix} state(Object)
自`1.11.0`版本支持，标注组件的交互状态配置。
标注线目前有如下4种状态，您可以配置这几种交互状态触发后，线的样式。

- `'hover'`：hover态
- `'hover_reverse'`：非hover状态
- `'selected'`：选中状态
- `'selected_reverse'`：非选中状态

##${prefix} hover(Object)
hover态。

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
非 hover态。

{{ use: component-marker-style-callback(
  description = '标注样式非hover状态支持回调'
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
选中态。

{{ use: component-marker-style-callback(
  description = '标注样式选中状态支持回调'
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
非选中态。

{{ use: component-marker-style-callback(
  description = '标注样式非选中状态支持回调'
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
