{{ target: mark-symbol }}

<!-- ISymbolMarkSpec -->

#${prefix} dx(number)

x 方向偏移。

#${prefix} dy(number)

y 方向偏移。

#${prefix} size(number)

大小。

#${prefix} shape(string)

形状。

可选值：

- `'circle'`
- `'cross'`
- `'diamond'`
- `'square'`
- `'arrow'`
- `'arrow2Left'`
- `'arrow2Right'`
- `'wedge'`
- `'thinTriangle'`
- `'triangle'`
- `'triangleUp'`
- `'triangleDown'`
- `'triangleRight'`
- `'triangleLeft'`
- `'stroke'` 注意，必须设置图形的 `stroke`属性，这个形状才能生效
- `'star'`
- `'wye'`
- `'rect'`

如需要实现自定义的形状，可以通过传入`svg`路径字符串实现自定义的形状，例如： `shape: 'M-0.5,-0.5L0.5,0.5L-0.5,0.5C'`
