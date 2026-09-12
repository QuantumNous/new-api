{{ target: mark-link-path }}

#${prefix} x0(number)

x0 坐标。

#${prefix} y0(number)

y0 坐标。

#${prefix} x1(number)

x1 坐标。

#${prefix} y1(number)

y1 坐标。

#${prefix} thickness(number)

厚度。

#${prefix} curvature(number)

曲率。

#${prefix} round(boolean)

对所有坐标进行四舍五入。

#${prefix} ratio(number)

普通样式路径的比例。

#${prefix} align(string)

对齐。

可选值：

- `start`
- `end`
- `center`

#${prefix} pathType(string)

path 类型。

可选值：

- `line`
- `smooth`
- `polyline`

#${prefix} endArrow(boolean)

是否有末尾端箭头。

#${prefix} startArrow(boolean)

是否有起点端箭头。

#${prefix} backgroundStyle(any)

背景样式配置。

#${prefix} direction(string)

方向。

可选值：

- `horizontal`
- `vertical`
- `LR`
- `RL`
- `TB`
- `BL`
- `radial`

{{ use: graphic-attribute(
  prefix = ${prefix},
) }}
