{{ target: mark-link-path }}

#${prefix} x0(number)

x0 coordinate.

#${prefix} y0(number)

y0 coordinate.

#${prefix} x1(number)

x1 coordinate.

#${prefix} y1(number)

y1 coordinate.

#${prefix} thickness(number)

Thickness.

#${prefix} curvature(number)

Curvature.

#${prefix} round(boolean)

Round all coordinates.

#${prefix} ratio(number)

Ratio of ordinary style path.

#${prefix} align(string)

Alignment.

Optional values:

- `start`
- `end`
- `center`

#${prefix} pathType(string)

Path type.

Optional values:

- `line`
- `smooth`
- `polyline`

#${prefix} endArrow(boolean)

Whether there is an end arrow.

#${prefix} startArrow(boolean)

Whether there is a start arrow.

#${prefix} backgroundStyle(any)

Background style configuration.

#${prefix} direction(string)

Direction.

Optional values:

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