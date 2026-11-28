{{ target: graphic-partial-stroke-style }}

{{ if: ${markType} === 'arc' }}
#${prefix} stroke(string | Array )

圆弧描边。支持使用 `'rgb(255,255,255)'`，`'rgba(255,255,255,1)'`，`'#fff'` 等方式设置为纯色，也支持设置为渐变色描边。  
在 `1.4.0` 版本后，支持配置为数组形式。数组含义为：[外弧描边，终止边描边，内弧描边，起始边描边]。

{{ else }}

#${prefix} stroke(string|Object)

描边颜色。支持使用 `'rgb(255,255,255)'`，`'rgba(255,255,255,1)'`，`'#fff'` 等方式设置为纯色，也支持设置为渐变色描边。

{{ /if }}

- 渐变色使用

{{ use: graphic-gradient }}

#${prefix} strokeOpacity(number)

描边透明度。

#${prefix} lineDash(number[])

用于填充线时配置虚线模式。它使用一组值来指定描述模式的线和间隙的交替长度。

> 备注： 如果要切换回至实线模式，将 dash list 设置为一个空数组即可。

示例：

```ts
lineDash: [2, 3];
// 切换回至实线模式
lineDash: [0];
```

#${prefix} lineDashOffset(number)

设置虚线偏移量的属性。更多详情可以参考 MDN [lineDashOffset](https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/lineDashOffset)。

#${prefix} lineWidth(number)

线宽。

#${prefix} lineCap(string)

指定如何绘制每一条线段末端的属性。有 3 个可能的值，分别是：`'butt'`, `'round'` and `'square'`。默认值是 butt。

#${prefix} lineJoin(string)

用来设置 2 个长度不为 0 的相连部分（线段、圆弧、曲线）如何连接在一起的属性（长度为 0 的变形部分，其指定的末端和控制点在同一位置，会被忽略）。此属性有 3 个值： `'round'`, `'bevel'` and `'miter'`。默认值是 `'miter'`。

#${prefix} miterLimit(number)

设置斜接面限制比例的属性。当获取属性值时，会返回当前的值（默认值是 10.0 ）。当给属性赋值时，0、负数、 Infinity 和 NaN 都会被忽略；除此之外都会被赋予一个新值。

<!-- TODO stroke: boolean, strokeTop: boolean 确认 -->
