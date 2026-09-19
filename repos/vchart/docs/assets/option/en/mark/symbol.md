{{ target: mark-symbol }}

<!-- ISymbolMarkSpec -->

#${prefix} dx(number)

Offset in the x direction.

#${prefix} dy(number)

Offset in the y direction.

#${prefix} size(number)

Size.

#${prefix} shape(string)

Shape.

Optional values:

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
- `'stroke'` Note that the `stroke` attribute must be set for this shape to take effect
- `'star'`
- `'wye'`
- `'rect'`

If you need to implement a custom shape, you can achieve this by passing an `svg` path string to customize the shape, for example: `shape: 'M-0.5,-0.5L0.5,0.5L-0.5,0.5C'`