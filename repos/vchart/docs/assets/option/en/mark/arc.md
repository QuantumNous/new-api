{{ target: mark-arc }}

<!-- IArcMarkSpec -->

#${prefix} startAngle(number)

Arc start angle.

#${prefix} endAngle(number)

Arc end angle.

#${prefix} padAngle(number)

Padding angle on both sides of the arc.

#${prefix} innerRadius(number)

Inner radius of the arc.

#${prefix} outerRadius(number)

Outer radius of the arc.

#${prefix} cornerRadius(number)

Corner radius of the arc.

#${prefix} centerOffset(number)

Offset distance of the arc center point.

#${prefix} cap(boolean)

Whether the rounded corners extend beyond the startAngle and endAngle.

#${prefix} autoCapConical(boolean)

Whether the cap part is effective when the arc has `cap = true` and applies a ring gradient.

{{ use: graphic-arc(
  prefix = ${prefix},
  markType = 'arc'
) }}
