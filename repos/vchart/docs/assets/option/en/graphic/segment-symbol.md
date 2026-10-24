{{ target: graphic-segment-symbol }}

<!-- SymbolAttributes in vis-components Segment component -->

#${prefix} visible(boolean)

Whether to display the symbol.

#${prefix} symbolType(string)

The shape of the symbol, default is an arrow with left and right directions. The following shapes are currently built-in: `'circle'`, `'cross'`, `'diamond'`, `'square'`, `'arrow'`, `'arrow2Left'`, `'arrow2Right'`, `'wedge'`, `'thinTriangle'`, `'triangle'`, `'triangleUp'`, `'triangleDown'`, `'triangleRight'`, `'triangleLeft'`, `'stroke'`, `'star'`, `'wye'`, `'rect'`.

#${prefix} size(number)

The size of the symbol.

#${prefix} refX(number)

The offset of the symbol in the parallel direction of the line.

#${prefix} refY(number)

The offset of the symbol in the orthogonal direction of the line.

#${prefix} refAngle(number)

The offset of the symbol from the default radian.

#${prefix} clip(boolean) = false

Whether the symbol clips the line, i.e. whether the part of the line inside the symbol is displayed when the symbol fill is false.

#${prefix} style(Object)

Style configuration.

{{ use: graphic-attribute(
  prefix = '#' + ${prefix},
  noAngle = true
) }}