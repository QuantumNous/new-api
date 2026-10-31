{{ target: component-brush-selected-item-style }}

#${prefix} symbol(string)

Symbol shape category of the graphic element (only valid when the selected graphic element type is `'symbol'`).

#${prefix} symbolSize(number)

Size of the graphic element (only valid when the selected graphic element type is `'symbol'`).

#${prefix} color(string)

Color of the graphic element.

#${prefix} colorAlpha(number)

Opacity of the graphic element, range `[0, 1]`.


{{ use: graphic-polygon(
  prefix = ${prefix}
) }}
