{{ target: component-mark-point }}

## markPoint (Array|Object)

Data mark point.

{{ use: component-base-marker(
  prefix = '##'
) }}

### x(string|number|function)

Supported since version `1.7.3`, the reference point is at the starting point of the x-axis. The value on the x-axis can be configured, or the aggregate calculation type, or calculated by itself through the data in the form of a callback.

- Relative position (string): x can be configured as a '15%' percentage, which means that the position is located at 15 percent of the region's horizontal axis (from left to right).
- Aggregation calculation type (string)
- Callback

{{ use: component-marker-aggregation-type() }}

### y(string|number|function)

Supported since `1.7.3` version, the position of the reference point on the y-axis can be configured with the value of the reference line on the y-axis, or the aggregate calculation type, or calculated by itself through data in the form of a callback.

- Relative position (string): y can be configured as a '15%' percentage, which means that the position is located at 15 percent of the region's vertical axis (from top to bottom).
- Aggregation calculation type (string)
- Callback

{{ use: component-marker-aggregation-type() }}

### angle (string | number | function)

Since the `1.11.0` version, the reference line is on the angle axis of the polar coordinate system, and the value of the marked point on the angle axis can be configured, or aggregated calculation, or self-calculation through data in the form of callbacks.

** Note that the usage scenario of this property is in the polar coordinate system: **

1. Configure the angle and radius properties together to label the data points with coordinates on (angle, radius)

### radius (string | number | function)

Since the `1.11.0` version, you can configure the value of the annotation point on the angle axis, or aggregate calculation, or calculate it yourself through the data in the form of a callback.

** Note that the usage scenario of this property is in the polar coordinate system: **

1. Configure the angle and radius properties together to label the data points with coordinates on (angle, radius)

### areaName (string | number | function)

Since the `1.11.0` version, you can configure the geographical location of the annotation point on the map, and calculate it yourself through the data in the form of a callback.

** Note that this property is used in a geographic coordinate system **

### coordinate(Object)

Mark target: data element.
Specifies the mark area for the data point. Draw the mark area based on the specified data point.

{{ use: component-marker-data-point(
  prefix = '###',
   isSingle = true
) }}

{{ use: component-marker-data-point-offset(
   prefix = '##',
   isSingle = true
) }}

### position(Object)

Mark target: coordinate point.
Specifies the mark area for the coordinate point. Draw the mark area based on the specified coordinate point.

{{ use: component-marker-point-like(
  prefix = '###',
   isSingle = true
) }}

### regionRelative(boolean) = false

Supported since `1.7.0` version, it only takes effect when positioning using the `position` attribute. Whether it is the coordinate relative to the region, the default is false, that is, the coordinate relative to the canvas, the default is false.

### relativeRelativeSeriesIndex(number)

The index of the series associated with the marked data (defaults to using the first valid series of the current region).

### relativeRelativeSeriesId(string)

The series ID associated with the marked data (defaults to using the first valid series of the current region).

### itemLine(Object)

Mark point guide line.

#### type(string)

Mark point guide line type.

Optional values:

- `'type-s'`: Direct connection between start and end points
- `'type-do'`: Indicates a folding point, where the x-coordinate of the folding point is the x-coordinate of 1/2 from the starting point to the end point, and the y-coordinate of the folding point is the y-coordinate of the starting point
- `'type-po'`: Indicates a folding point, where the x-coordinate of the folding point is the x-coordinate of the end point, and the y-coordinate of the folding point is the y-coordinate of the starting point
- `'type-op'`: Indicates a folding point, where the x-coordinate of the folding point is the x-coordinate of the starting point, and the y-coordinate of the folding point is the y-coordinate of the end point
- `'type-arc'`: arc, the center of the circle is determined by `itemLine.arcRatio`.

For more specific forms, refer to: https://journals.sagepub.com/doi/10.1177/1473871618799500

#### visible(boolean)

Mark point guide line visibility.

#### decorativeLine(Object)

Decorative line perpendicular to the guide line.

##### visible(boolean)

Decorative line visibility.

#### arcRatio(number)

Supported since `1.11.1` version, it takes effect when type is type-arc. The value determines the offset from the center of the circle to the end point. The smaller the absolute value, the greater the curvature. The sign determines the normal direction and cannot be equal to 0.

##### length(boolean)

Decorative line length.

#### startSymbol(Object)

Guide line start point symbol style.

{{ use: component-marker-symbol(
  prefix = '####'
) }}

#### endSymbol(Object)

Guide line end point symbol style.

{{ use: component-marker-symbol(
  prefix = '####'
) }}

#### line(Object)

{{ use: component-marker-state(
  prefix = '####',
  graphicType = 'line'
) }}

##### style(Object)

Guide line style.

{{ use: graphic-line(
  prefix = '#####'
) }}

### itemContent(Object)

Mark content.

#### type(string)

Mark content type.

Optional values:

- 'symbol'
- 'text'
- 'image'
- 'richText'

#### position(string)

Position of the mark content relative to the positioning point.

Optional values:

- 'top'
- 'bottom'
- 'middle'
- 'insideTop'
- 'insideBottom'
- 'insideMiddle'

layout like this: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/marker-position.png

#### offsetX(number)

The x-direction offset of the mark content relative to the mark point.

In addition to directly configuring offset values, since the `1.11.0` version:

1. `'regionRight'` | `'regionLeft'`: Used to place at the leftmost or rightmost end of the region.
2. Callback form

```ts
(Region: IRegion) = > number
```

#### offsetY(number)

The y-direction offset of the mark content relative to the mark point.

In addition to directly configuring offset values, since the `1.11.0` version:

1. `'regionTop'` | `'regionBottom'`: Used to place at the topmost or bottommost end of the region.
2. Callback form

```ts
(Region: IRegion) = > number
```

#### confine(boolean) = false

Since version 1.8.7, whether to automatically adjust item content so that it is displayed within the visible area of ​​​​the marker.

#### text(Object)

For mark content type 'text', the text style.

{{ use: component-marker-label(
  prefix = '####',
  noConfine = true,
  noMarkerRef = true,
  noAutoRotate = true
) }}

#### style(Object)

{{ use: component-marker-style-callback(
  description = 'image | text | richText | symbol style'
) }}

{{ use: graphic-image(
  prefix = '####'
) }}

{{ use: graphic-text(
  prefix = '####'
) }}

{{ use: graphic-rich-text(
  prefix = '####'
) }}

{{ use: graphic-symbol(
  prefix = '####'
) }}

{{ use: component-marker-state(
  prefix = '###',
  graphicType = 'all'
) }}

{{ use: component-marker-animation(
  prefix = '##',
  markerType = 'markPoint',
  animationType = 'callIn | fadeIn'
) }}

### targetSymbol(Object)

Supported since version `1.11.1`, prefixed tag.

#### offset

The gap between the marked content and the marked line.

#### visible = false

Whether to display.

#### size

size.

#### style(Object)

The style of targetSymbol.
{{ use: component-marker-style-callback(
  description = 'targetSymbol style'
) }}

{{ use: graphic-symbol(
  prefix = '####'
) }}
