{{ target: border-style }}

#${prefix} stroke(string|Object)

描边颜色。支持使用 `'rgb(255,255,255)'`，`'rgba(255,255,255,1)'`，`'#fff'` 等方式设置为纯色，也支持设置为渐变色描边。

- 渐变色使用

{{ use: graphic-gradient }}

#${prefix} strokeOpacity(number)

描边透明度。

#${prefix} lineDash(number[]) = [0]

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

#${prefix} lineWidth(number) = 0

线宽。

#${prefix} distance(number) = 0

外描边距离，单位 px。
