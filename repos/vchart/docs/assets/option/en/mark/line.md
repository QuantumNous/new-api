{{ target: mark-line }}

<!-- ILineMarkSpec -->

#${prefix} curveType(string)

Curve interpolation type.

Available options:

- `basis`
- `linear`
- `monotone`
- `monotoneX`
- `monotoneY`
- `step`
- `stepAfter`
- `stepBefore`
- `linearClosed`
- `catmullRom`
- `catmullRomClosed`

#${prefix} defined(boolean)

Indicates if it is a valid number.

#${prefix} enableSegments(boolean)

A flag to inform Sirius if it should execute the getLineSegmentConfigs method.

#${prefix} strokeBoundsBuffer(number)

The bounded buffer for stroke.

{{ use: graphic-line(
  prefix = ${prefix}
) }}
