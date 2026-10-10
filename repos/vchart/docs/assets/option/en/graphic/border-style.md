{{ target: border-style }}

#${prefix} stroke(string|Object)

Stroke color. Supports setting to a solid color using `'rgb (255, 255, 255)'`, `'rgba (255, 255, 255, 1)'`, `'#fff'`, etc., and also supports setting it to a gradient stroke color.

- Gradient color usage

{{ use: graphic-gradient }}

#${prefix} strokeOpacity(number)

Stroke opacity.

#${prefix} lineDash(number[]) = [0]

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

#${prefix} lineWidth(number) = 0

Line width.

#${prefix} distance(number) = 0

border distance, in px.
