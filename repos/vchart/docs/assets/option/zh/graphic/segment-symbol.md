{{ target: graphic-segment-symbol }}

<!-- vis-components 中 Segment 组件的 SymbolAttributes -->

#${prefix} visible(boolean)

是否展示 symbol。

#${prefix} symbolType(string)

symbol 形状，默认为带左右方向的箭头。目前内置了如下形状：`'circle'`, `'cross'`, `'diamond'`, `'square'`, `'arrow'`, `'arrow2Left'`, `'arrow2Right'`, `'wedge'`, `'thinTriangle'`, `'triangle'`, `'triangleUp'`, `'triangleDown'`, `'triangleRight'`, `'triangleLeft'`, `'stroke'`, `'star'`, `'wye'`, `'rect'`。

#${prefix} size(number)

symbol 大小。

#${prefix} refX(number)

symbol 相对 line 平行方向上的偏移。

#${prefix} refY(number)

symbol 相对 line 正交方向上的偏移。

#${prefix} refAngle(number)

symbol 相对默认弧度的偏移。

#${prefix} clip(boolean) = false

symbol 是否 clip line，即当 symbol fill 为 false 时，line 在 symbol 内部的部分是否展示。

#${prefix} style(Object)

样式配置。

{{ use: graphic-attribute(
  prefix = '#' + ${prefix},
  noAngle = true
) }}
