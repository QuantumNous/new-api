{{ target: graphic-partial-stroke-style }}

{{ if: ${markType} === 'arc' }}
#${prefix} stroke(string | Array )

Stroke color. Supports setting to a solid color using `'rgb (255, 255, 255)'`, `'rgba (255, 255, 255, 1)'`, `'#fff'`, etc., and also supports setting it to a gradient stroke color.

Since version `1.4.0`, it supports configuration in array form. The array means: [outer arc stroke, end edge stroke, inner arc stroke, start edge stroke].

{{ else }}
#${prefix} stroke(string|Object)

{{ /if }}
Stroke color. Supports setting to a solid color using `'rgb (255, 255, 255)'`, `'rgba (255, 255, 255, 1)'`, `'#fff'`, etc., and also supports setting it to a gradient stroke color.

- Gradient color usage

{{ use: graphic-gradient }}

#${prefix} strokeOpacity(number)

Stroke opacity.

#${prefix} lineDash(number[])

Used to configure the dashed line mode when filling lines. It uses an array of values to specify the alternating lengths of lines and gaps that describe the pattern.

> Note: To switch back to the solid line mode, set the dash list to an empty array.

Example:

```ts
lineDash: [2, 3];
// 切换回至实线模式
lineDash: [0];
```

#${prefix} lineDashOffset(number)

An attribute to set the dashed line offset. For more details, you can refer to MDN [lineDashOffset](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/lineDashOffset).

#${prefix} lineWidth(number)

Line width.

#${prefix} lineCap(string)

An attribute that specifies how to draw the end of each line segment. There are 3 possible values: `'butt'`, `'round'`, and `'square'`. The default value is butt.

#${prefix} lineJoin(string)

An attribute used to set how the two connected parts (segments, arcs, curves) of non-zero length are connected together (the deformed part whose specified end and control points are in the same position with a length of 0 will be ignored). This attribute has 3 values: `'round'`, `'bevel'`, and `'miter'`. The default value is `'miter'`.

#${prefix} miterLimit(number)

An attribute that sets the limit ratio of the beveled surface. When the attribute value is obtained, the current value (the default value is 10.0) will be returned. When the attribute is set, 0, negative numbers, Infinity, and NaN will be ignored; all others will be assigned a new value.

<!-- TODO stroke: boolean, strokeTop: boolean confirm -->
