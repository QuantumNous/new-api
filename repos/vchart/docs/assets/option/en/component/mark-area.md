{{ target: component-mark-area }}

## markArea (Array|Object)

Data annotation area.

{{ use: component-base-marker(
   prefix = '##'
) }}

### x(string|number|function)

Annotation target: Cartesian coordinate system x coordinate space.
The boundary of the marking area on the x-axis, used together with markArea.x1 to construct the marking area. You can configure the value on the x-axis, relative position, or aggregation calculation type.

- Relative position (string): Supported since `1.7.0` version, x can be configured in the form of '15%' percentage, which is used to indicate that x is drawn on the horizontal axis (from left to right) of the region where the marker is located. 15/10 position.
- Aggregation calculation type (string)
- Callback

{{ use: component-marker-aggregation-type() }}

### x1(string|number|function)

Annotation target: Cartesian coordinate system x coordinate space.
The boundary of the marking area on the x-axis, used together with markArea.x to construct the marking area. You can configure the value on the x-axis, relative position, or aggregation calculation type.

- Relative position (string): Supported since `1.7.0` version, x1 can be configured in the form of '15%' percentage, which is used to indicate that x1 is drawn on the horizontal axis (from left to right) of the region where the marker is located. 15/10 position.
- Aggregation calculation type (string)
- Callback

{{ use: component-marker-aggregation-type() }}

### y(string|number|function)

The boundary of the marking area on the y-axis, which together with markArea.y1 constructs the marking area. You can configure the value on the y-axis, relative position, or aggregation calculation type.

- Relative position (string): Supported since `1.7.0` version, y can be configured in the form of '15%' percentage, which is used to indicate that y is drawn on the vertical axis (from top to bottom) of the region where the marker is located. 15/10 position.
- Aggregation calculation type (string)
- Callback

{{ use: component-marker-aggregation-type() }}

### y1(string|number|function)

The boundary of the marking area on the y-axis, which together with markArea.y constructs the marking area. You can configure the value on the y-axis, relative position, or aggregation calculation type.

- Relative position (string): Supported since `1.7.0` version, y1 can be configured in the form of '15%' percentage, which is used to indicate that y1 is drawn on the vertical axis (from top to bottom) of the region where the marker is located. 15/10 position.
- Aggregation calculation type (string)
- Callback

{{ use: component-marker-aggregation-type() }}

### angle (string | number | function)

Since the `1.11.0` version, the reference line is on the angle axis of the polar coordinate system, and the value on the angle axis can be configured, or aggregated calculation, or self-calculation through data in the form of callbacks.

** Note that the usage scenario of this property is in the polar coordinate system: **

1. Configure the angle and angle1 properties together to draw the sector annotation area enclosed by angle and angle1
2. With the configuration of radius, radius1, angle and angle1 properties, it is used to draw the ring label range with the inner and outer radii of radius and radius1 respectively, and the angle is angle to angle1.

### radius (string | number | function)

Since the `1.11.0` version, the reference line is on the radius axis of the polar coordinate system, and the value on the radius axis can be configured, or aggregated calculations, or self-calculated through the data in the form of callbacks.

** Note that the usage scenario of this property is in the polar coordinate system: **

1. With the configuration of radius and radius1 properties, it is used to draw the annular labeling range with inner and outer radii of radius and radius1 respectively.
2. With the configuration of radius, radius1, angle and angle1 properties, it is used to draw the ring label range with the inner and outer radii of radius and radius1 respectively, and the angle is angle to angle1.

### angle1 (string | number | function)

Since the `1.11.0` version, the reference line is on the angle axis of the polar coordinate system, and the value on the angle axis can be configured, or aggregated calculation, or self-calculation through data in the form of callbacks.

** Note that the usage scenario of this property is in the polar coordinate system: **

1. Configure the angle and angle1 properties together to draw the sector annotation area enclosed by angle and angle1
2. With the configuration of radius, radius1, angle and angle1 properties, it is used to draw the ring label range with the inner and outer radii of radius and radius1 respectively, and the angle is angle to angle1.

### radius1 (string | number | function)

Since the `1.11.0` version, the reference line is on the radius axis of the polar coordinate system, and the value on the radius axis can be configured, or aggregated calculations, or self-calculated through the data in the form of callbacks.

** Note that the usage scenario of this property is in the polar coordinate system: **

1. With the configuration of radius and radius1 properties, it is used to draw the annular labeling range with inner and outer radii of radius and radius1 respectively.
2. With the configuration of radius, radius1, angle and angle1 properties, it is used to draw the ring label range with the inner and outer radii of radius and radius1 respectively, and the angle is angle to angle1.

### coordinates(Array)

Label target: data element.
Specifies the label area for data points. Draw the labeled area based on specified data points.

{{ use: component-marker-data-point(
   prefix = '###'
) }}

{{ use: component-marker-data-point-offset(
   prefix = '##'
) }}

### positions(Array)

Label target: coordinate point.
Specify the labeling area of the coordinate point. Draw the labeled area based on the specified coordinate points.

{{ use: component-marker-point-like(
   prefix = '###'
) }}

### regionRelative(boolean) = false

Supported since `1.7.0` version, Only takes effect when positioning using the `positions` attribute, whether it is the coordinate relative to the region, the default is false, that is, the coordinate relative to the canvas, the default is false.

{{ use: component-marker-axis(
   prefix = '##'
) }}

### area(Object)

The area state and style for the label area.

{{ use: component-marker-state(
  prefix = '###',
  graphicType = 'polygon'
) }}

#### style(Object)

The area style for the label area.

{{ use: component-marker-style-callback(
  description = 'area style'
) }}

{{ use: graphic-polygon(
   prefix = '####'
) }}

### label(Array|Object)

Label style for dimension lines.
Since `1.13.9`, configuring multiple labels is supported.

#### position(Object)

The label position of the annotation area (the relative position of the label relative to the area).

Optional values:

Cartesian coordinate system:

- `'left'`: left side outside the area
- `'right'`: Right outside the area
- `'top'`: the upper side outside the area
- `'bottom'`: the lower side outside the area
- `'middle'`: regional center
- `'insideLeft'`: the left side inside the area
- `'insideRight'`: the right side inside the area
- `'insideTop'`: the upper side inside the area
- `'insideBottom'`: the lower side inside the area

Supported since version 1.13.4:

- `'topLeft'`: the upper left side outside the area,
- `'topRight'`: the upper right side outside the area,
- `'bottomLeft'`: the lower left side outside the area,
- `'bottomRight'`: the lower right side outside the area,
- `'insideTopLeft'`: the upper left side inside the area,
- `'insideTopRight'`: the upper right side inside the area,
- `'insideBottomLeft'`: the lower right side inside the area,
- `'insideBottomRight'`: the lower right side inside the area

Polar coordinate system:

- `'arcInnerStart'`: inside the starting point of the arc
- `'arcInnerEnd'`: inside the end of the arc
- `'arcInnerMiddle'`: inside the midpoint of the arc
- `'arcOuterStart`': outside the starting point of the arc
- `'arcOuterEnd'`: outside the end of the arc
- `'arcOuterMiddle'`: outside the midpoint of the arc
- `'center'`: arc center

{{ use: component-marker-label(
   prefix = '###',
   noMarkerRef = true
) }}

{{ use: component-marker-animation(
  prefix = '##',
  markerType = 'markArea',
  animationType = 'fadeIn'
) }}
