{{ target: mark-group }}

<!-- IGroupMarkSpec -->

#${prefix} clip(boolean)
Whether to clip the primitive.

#${prefix} width(number)
width.

#${prefix} height(number)
high.

#${prefix} cornerRadius(number|number[])
Rounded corner configuration.
1. If a value is passed in, the four corners will be uniformly rounded.
2. If an array is passed in, they will be [top left, top right, bottom right, bottom left]

{{ use: graphic-attribute(
  prefix = ${prefix},
) }}