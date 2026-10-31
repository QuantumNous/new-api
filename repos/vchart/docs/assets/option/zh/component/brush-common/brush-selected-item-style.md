{{ target: component-brush-selected-item-style }}

#${prefix} symbol(string)

图元的图形类别（仅在被框选的图元类型为`'symbol'`时有效。

#${prefix} symbolSize(number)

图元的大小（仅在被框选的图元类型为`'symbol'`时有效。

#${prefix} color(string)

图元的颜色。

#${prefix} colorAlpha(number)

图元的透明度，范围`[0, 1]`。

{{ use: graphic-polygon(
  prefix = ${prefix}
) }}


