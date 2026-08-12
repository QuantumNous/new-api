{{ target: graphic-rect3d }}

<!-- Canopus Graphic Attribute, IRectGraphicAttribute -->

#${prefix} cornerRadius(number|number[])

Rectangle corner radius configuration, the value of cornerRadius can be either a single number or an array, separately specifying the corner radius sizes in 4 directions.

#${prefix} length(number|number[])

Rectangle depth (length) setting. 3D columns have three properties - length, width, and height, while 2D columns have width and height properties. The additional length property in 3D represents the depth in the z direction.

{{ use: graphic-attribute(
  prefix = ${prefix},
) }}