{{ target: component-marker-symbol }}

#${prefix} visible(boolean)

symbol图元是否可见。

#${prefix} symbolType(string)

symbol图元形状。

可选配置：
- `'circle'`
- `'cross''diamond'`
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
- `'stroke'`
- `'star'`
- `'wye'`
- `'rect'`

#${prefix} size(number)

symbol图元大小。

{{ use: component-marker-state(
  prefix = ${prefix},
  graphicType = 'symbol'
) }}

#${prefix} style(Object)

symbol图元样式。

{{ use: component-marker-style-callback(
  description = 'symbol图元样式'
) }}

{{ use: graphic-symbol(
  prefix = '#' + ${prefix}
) }}

{{ use: component-marker-ref(
  prefix = ${prefix}
) }}



