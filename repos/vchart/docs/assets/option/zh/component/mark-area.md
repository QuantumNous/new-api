{{ target: component-mark-area }}

## markArea (Array|Object)

数据标注区域。

{{ use: component-base-marker(
  prefix = '##'
) }}

### x(string|number|function)

标注目标：笛卡尔坐标系 x 坐标空间。
x 轴上的标注区域边界，与 markArea.x1 共同构造标注区域。可以配置在 x 轴上的值，相对位置，或者聚合计算类型。

- 相对位置（string）：自 `1.7.0` 版本开始支持，可以将 x 配置为 '15%' 百分比的形式，用于表示将 x 绘制在 marker 所在 region 横轴（从左往右）的百分之 15 位置处。
- 聚合计算类型（string）
- 回调函数

{{ use: component-marker-aggregation-type() }}

### x1(string|number|function)

标注目标：笛卡尔坐标系 x 坐标空间。
x 轴上的标注区域边界，与 markArea.x 共同构造标注区域。可以配置在 x 轴上的值，相对位置，或者聚合计算类型。

- 相对位置（string）：自 `1.7.0` 版本开始支持，可以将 x1 配置为 '15%' 百分比的形式，用于表示将 x1 绘制在 marker 所在 region 横轴（从左往右）的百分之 15 位置处。
- 聚合计算类型（string）
- 回调函数

{{ use: component-marker-aggregation-type() }}

### y(string|number|function)

y 轴上的标注区域边界，与 markArea.y1 共同构造标注区域。可以配置在 y 轴上的值，相对位置，或者聚合计算类型。

- 相对位置（string）：自 `1.7.0` 版本开始支持，可以将 y 配置为 '15%' 百分比的形式，用于表示将 y 绘制在 marker 所在 region 纵轴（从上到下）的百分之 15 位置处。
- 聚合计算类型（string）
- 回调函数

{{ use: component-marker-aggregation-type() }}

### y1(string|number|function)

y 轴上的标注区域边界，与 markArea.y 共同构造标注区域。可以配置在 y 轴上的值，相对位置，或者聚合计算类型。

- 相对位置（string）：自 `1.7.0` 版本开始支持，可以将 y1 配置为 '15%' 百分比的形式，用于表示将 y1 绘制在 marker 所在 region 纵轴（从上到下）的百分之 15 位置处。
- 聚合计算类型（string）
- 回调函数

{{ use: component-marker-aggregation-type() }}

### angle(string|number|function)

自`1.11.0`版本开始支持, 该参考线在极坐标系的 angle 轴上，可以配置 angle 轴上的值, 或者聚合计算，或者以回调的形式通过数据自行计算。

**注意该属性的使用场景为极坐标系下：**

1. 配合配置 angle 和 angle1 属性，用于绘制由 angle 和 angle1 的围成的扇区标注区域
2. 配合配置 radius, radius1, angle 和 angle1 属性，用于绘制内外半径分别为 radius、radius1，且角度为 angle 到 angle1 的环形标注范围。

### radius(string|number|function)

自`1.11.0`版本开始支持, 该参考线在极坐标系的 radius 轴上，可以配置 radius 轴上的值, 或者聚合计算，或者以回调的形式通过数据自行计算。

**注意该属性的使用场景为极坐标系下：**

1. 配合配置 radius 和 radius1 属性，用于绘制内外半径分别为 radius、radius1 的环形标注范围。
2. 配合配置 radius, radius1, angle 和 angle1 属性，用于绘制内外半径分别为 radius、radius1，且角度为 angle 到 angle1 的环形标注范围。

### angle1(string|number|function)

自`1.11.0`版本开始支持, 该参考线在极坐标系的 angle 轴上，可以配置 angle 轴上的值, 或者聚合计算，或者以回调的形式通过数据自行计算。

**注意该属性的使用场景为极坐标系下：**

1. 配合配置 angle 和 angle1 属性，用于绘制由 angle 和 angle1 的围成的扇区标注区域
2. 配合配置 radius, radius1, angle 和 angle1 属性，用于绘制内外半径分别为 radius、radius1，且角度为 angle 到 angle1 的环形标注范围。

### radius1(string|number|function)

自`1.11.0`版本开始支持, 该参考线在极坐标系的 radius 轴上，可以配置 radius 轴上的值, 或者聚合计算，或者以回调的形式通过数据自行计算。

**注意该属性的使用场景为极坐标系下：**

1. 配合配置 radius 和 radius1 属性，用于绘制内外半径分别为 radius、radius1 的环形标注范围。
2. 配合配置 radius, radius1, angle 和 angle1 属性，用于绘制内外半径分别为 radius、radius1，且角度为 angle 到 angle1 的环形标注范围。

### coordinates(Array)

标注目标：数据元素。
指定数据点的标注区域。基于指定数据点进行标注区域的绘制。

{{ use: component-marker-data-point(
  prefix = '###'
) }}

{{ use: component-marker-data-point-offset(
   prefix = '##'
) }}

### positions(Array)

标注目标：坐标点。
指定坐标点的标注区域。基于指定坐标点进行标注区域的绘制。

{{ use: component-marker-point-like(
  prefix = '###'
) }}

### regionRelative(boolean) = false

自 `1.7.0` 版本支持，仅对使用 `positions` 属性进行定位的情况生效，是否为相对 region 的坐标，默认为 false，即相对画布的坐标，默认 false。

{{ use: component-marker-axis(
  prefix = '##'
) }}

### area(Object)

标注区域的区域状态和样式。

{{ use: component-marker-state(
  prefix = '###',
  graphicType = 'polygon'
) }}

#### style(Object)

标注区域的区域样式。

{{ use: component-marker-style-callback(
  description = '区域样式'
) }}

{{ use: graphic-polygon(
  prefix = '####'
) }}

### label(Array|Object)

标注线的标签样式。
自 `1.13.9` 版本开始，支持配置多个标签。

#### position(Object)

标注区域的标签位置（标签相对区域的相对位置）。

可选值：

直角坐标系下:

- `'left'`: 区域外部左侧
- `'right'`: 区域外部右侧
- `'top'`: 区域外部上侧
- `'bottom'`: 区域外部下侧
- `'middle'`: 区域中心
- `'insideLeft'`: 区域内部左侧
- `'insideRight'`: 区域内部右侧
- `'insideTop'`: 区域内部上侧
- `'insideBottom'`: 区域内部下侧
  自 1.13.4 版本支持:
- `'topLeft'`: 区域外侧左上侧,
- `'topRight'`: 区域外侧右上侧,
- `'bottomLeft'`: 区域外侧左下侧,
- `'bottomRight'`: 区域外侧右下侧,
- `'insideTopLeft'`: 区域内侧左上侧,
- `'insideTopRight'`: 区域内侧右上侧,
- `'insideBottomLeft'`: 区域内侧右上侧,
- `'insideBottomRight'`: 区域内侧右下侧

极坐标系下:

- `'arcInnerStart'`: 弧线起点内侧
- `'arcInnerEnd'`: 弧线终点内侧
- `'arcInnerMiddle'` : 弧线中点内侧
- `'arcOuterStart'`: 弧线起点外侧
- `'arcOuterEnd'`: 弧线终点外侧
- `'arcOuterMiddle'`: 弧线中点外侧
- `'center'`: 弧线中心

{{ use: component-marker-label(
  prefix = '###',
  noMarkerRef = true
) }}

{{ use: component-marker-animation(
  prefix = '##',
  markerType = 'markArea',
  animationType = 'fadeIn'
) }}
