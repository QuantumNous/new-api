{{ target: component-mark-point }}

## markPoint (Array|Object)

数据标注点。

{{ use: component-base-marker(
  prefix = '##'
) }}

### x(string|number|function)

自 `1.7.3` 版本支持，参考点在 x 轴的起点位置，可以配置 x 轴上的值，或者聚合计算类型，或者以回调的形式通过数据自行计算。

- 相对位置（string）：可以将 x 配置为 '15%' 百分比的形式，表示该位置位于 region 横轴（从左往右）的百分之 15 位置处。
- 聚合计算类型（string）
- 回调函数

{{ use: component-marker-aggregation-type() }}

### y(string|number|function)

自 `1.7.3` 版本支持，参考点在 y 轴上位置，可以配置参考线在 y 轴上的值，或者聚合计算类型，或者以回调的形式通过数据自行计算。

- 相对位置（string）：可以将 y 配置为 '15%' 百分比的形式，表示该位置位于 region 纵轴（从上到下）的百分之 15 位置处。
- 聚合计算类型（string）
- 回调函数

### angle(string|number|function)

自`1.11.0`版本开始支持, 该参考线在极坐标系的 angle 轴上, 可以配置标注点在 angle 轴上的值, 或者聚合计算，或者以回调的形式通过数据自行计算。

**注意该属性的使用场景为极坐标系下:**

1. 配合配置 angle，radius 属性，用于标注坐标在(angle, radius)上的数据点

### radius(string|number|function)

自`1.11.0`版本开始支持, 可以配置标注点在 angle 轴上的值, 或者聚合计算，或者以回调的形式通过数据自行计算。

**注意该属性的使用场景为极坐标系下:**

1. 配合配置 angle，radius 属性，用于标注坐标在(angle, radius)上的数据点

### areaName(string|number|function)

自`1.11.0`版本开始支持, 可以配置标注点在地图上的地理位置, 以回调的形式通过数据自行计算。

**注意该属性的使用场景为地理坐标系**

{{ use: component-marker-aggregation-type() }}

### coordinate(Object)

标注目标：数据元素。
指定数据点的标注区域。基于指定数据点进行标注区域的绘制。

{{ use: component-marker-data-point(
  prefix = '###',
   isSingle = true
) }}

{{ use: component-marker-data-point-offset(
   prefix = '##',
   isSingle = true
) }}

### position(Object)

标注目标：坐标点。
指定坐标点的标注区域。基于指定坐标点进行标注区域的绘制。

{{ use: component-marker-point-like(
  prefix = '###',
   isSingle = true
) }}

### regionRelative(boolean) = false

自 `1.7.0` 版本支持，仅对使用 `position` 属性进行定位的情况生效，是否为相对 region 的坐标，默认为 false，即相对画布的坐标，默认 false。

### relativeRelativeSeriesIndex(number)

被标注数据关联的 series 索引（默认使用当前 region 第一个有效 series）。

### relativeRelativeSeriesId(string)

被标注数据关联的 series ID（默认使用当前 region 第一个有效 series）。

### itemLine(Object)

标注点引导线。

#### type(string)

标注点引导线类型。

可选值：

- `'type-s'`: 起点和终点直接连线
- `'type-do'`: 表示包含一个折点，且折点 x 坐标为起点到终点的 1/2 x 坐标，折点 y 坐标为起点 y 坐标
- `'type-po'`: 表示包含一个折点，且折点 x 坐标为终点 x 坐标，折点 y 坐标为起点 y 坐标
- `'type-op'`: 表示包含一个折点，且折点 x 坐标为起点 x 坐标，折点 y 坐标为终点 y 坐标
- `'type-arc'`: 弧线，圆心由`itemLine.arcRatio`决定。

具体形式参考：https://journals.sagepub.com/doi/10.1177/1473871618799500

#### visible(boolean)

标注点引导线可见性。

#### arcRatio(number)

自`1.11.1`版本支持, 当 type 为 type-arc 时生效, 数值决定圆心到终点连线的偏移量, 绝对值越小, 曲率越大, 符号决定法向, 不能等于 0。

#### decorativeLine(Object)

垂直于引导线的装饰线。

##### visible(boolean)

装饰线可见性。

##### length(boolean)

装饰线长度。

#### startSymbol(Object)

引导线起点 symbol 样式。

{{ use: component-marker-symbol(
  prefix = '####'
) }}

#### endSymbol(Object)

引导线终点 symbol 样式。

{{ use: component-marker-symbol(
  prefix = '####'
) }}

#### line(Object)

{{ use: component-marker-state(
  prefix = '####',
  graphicType = 'line'
) }}

##### style(Object)

引导线样式。

{{ use: graphic-line(
  prefix = '#####'
) }}

### itemContent(Object)

标注内容。

#### type(string)

标注内容类型。

可选值：

- 'symbol'
- 'text'
- 'image'
- 'richText'

#### position(string)

标注内容相对于定位点的位置。

可选值：

- 'top'
- 'bottom'
- 'middle'
- 'insideTop'
- 'insideBottom'
- 'insideMiddle'

位置布局可参考: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/marker-position.png

#### offsetX(number)

标注内容相对于标注点的 x 方向偏移量。

除了直接配置偏移量数值外，自`1.11.0` 版本起提供了：

1. `'regionRight' | 'regionLeft'`: 用于放置在 region 最左端或最右端。
2. 回调形式

```ts
(region: IRegion) => number;
```

#### offsetY(number)

标注内容相对于标注点的 y 方向偏移量。

除了直接配置偏移量数值外，自`1.11.0` 版本起提供了：

1. `'regionTop' | 'regionBottom'`: 用于放置在 region 最顶端或最底端。
2. 回调形式

```ts
(region: IRegion) => number;
```

{{ use: component-marker-ref(
  prefix = '###'
) }}

#### confine(boolean) = false

自 1.8.7 版本开始, 是否自动调整 item content 使其展示在 marker 可见区域内。

#### text(Object)

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

自`1.11.1`版本支持, 前置标记。

#### offset

被标注内容与标记线间的间隙。

#### visible = false

是否显示。

#### size

大小。

#### style(Object)

targetSymbol 的样式。
{{ use: component-marker-style-callback(
  description = 'targetSymbol样式'
) }}

{{ use: graphic-symbol(
  prefix = '####'
) }}
