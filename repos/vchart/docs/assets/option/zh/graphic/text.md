{{ target: graphic-text }}

<!-- Canopus 图形属性，ITextGraphicAttribute -->

{{
  use: graphic-text-font(
    prefix = ${prefix}
  )
}}

{{
  use: graphic-text-poptip(
    prefix = ${prefix}
  )
}}

{{ use: graphic-attribute(
  prefix = ${prefix},
  noTexture = true
) }}
