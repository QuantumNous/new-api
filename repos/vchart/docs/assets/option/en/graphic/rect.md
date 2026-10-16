{{ target: graphic-rect }}

<!-- Canopus Graphic Attributes, IRectGraphicAttribute -->

#${prefix} cornerRadius(number|number[])

The configuration of the rounded corners of the rectangle. The value of cornerRadius can be a single number or an array, specifying the rounded corner sizes in 4 directions.

#${prefix} width(number)
width of rect.

#${prefix} height(number)
height of rect.


{{ use: graphic-attribute(
  prefix = ${prefix},
) }}
