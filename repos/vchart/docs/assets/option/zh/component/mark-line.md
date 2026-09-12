{{ target: component-mark-line }}

## markLine (Array|Object)

数据标注线。

{{ use: component-base-marker(
  prefix = '##'
) }}

### type(string)= 'type-step'

用于指定辅助线的连接类型，step 的连接方式为由交替的水平线和处置线组成的。

### connectDirection(string)

当且仅当声明 `type: 'type-step'` 时生效，用于配置线的链接方向，可选值：'top' | 'bottom' | 'left' | 'right'。

### expandDistance(string|number)

当且仅当声明 `type: 'type-step'` 时生效，用于配置在连接方向的扩展距离。

- number 类型为像素值
- string 类型为百分比，相对于 region 区域宽度/高度的百分比，如 '30%'

### x(string|number|function)

标注目标：笛卡尔坐标系 x 坐标空间。
x 轴上的参考线。可以配置参考线在 x 轴上的值，或者聚合计算类型，或者以回调的形式通过数据自行计算。

- 相对位置（string）：自 `1.7.0` 版本开始支持，可以将 x 配置为 '15%' 百分比的形式，用于表示将 x 绘制在 marker 所在 region 横轴（从左往右）的百分之 15 位置处。
- 聚合计算类型（string）
- 回调函数

**注意：**

1. 单独声明 x 属性，可以绘制一条贯穿 y 轴的标注线
2. 配合配置 y 和 y1 属性，可以声明 y 轴的绘制范围
3. 配合配置 x1， y 和 y1 属性，为通过配置标注线两个端点 (x, y) 和 (x1, y1)

{{ use: component-marker-aggregation-type() }}

### y(string|number|function)

标注目标：笛卡尔坐标系 y 坐标空间。
参考线在 y 轴上位置，可以配置参考线在 y 轴上的值，或者聚合计算类型，或者以回调的形式通过数据自行计算。

- 相对位置（string）：自 `1.7.0` 版本开始支持，可以将 y 配置为 '15%' 百分比的形式，用于表示将 y 绘制在 marker 所在 region 纵轴（从上往下）的百分之 15 位置处。
- 聚合计算类型（string）
- 回调函数

{{ use: component-marker-aggregation-type() }}

**注意：**

1. 单独声明 y 属性，可以绘制一条贯穿 x 轴的标注线
2. 配合配置 x 和 x1 属性，可以声明 x 轴的绘制范围
3. 配合配置 x， x1 和 y1 属性，为通过配置标注线两个端点 (x, y) 和 (x1, y1)

### x1(string|number|function)

自 `1.7.3` 版本开始支持，该参考线在 x 轴的终点位置，可以配置 x 轴上的值，或者聚合计算类型，或者以回调的形式通过数据自行计算。

**注意该属性的使用场景为：**

1. 配合配置 y, x 和 x1 属性，用于在 y 轴上绘制 x 到 x1 范围的标注线
2. 配合配置 x，x1， y 和 y1 属性，为通过配置标注线两个端点 (x, y) 和 (x1, y1)

- 相对位置（string）：可以将 x 配置为 '15%' 百分比的形式，用于表示将 x 绘制在 marker 所在 region 横轴（从左往右）的百分之 15 位置处。
- 聚合计算类型（string）
- 回调函数

{{ use: component-marker-aggregation-type() }}

### y1(string|number|function)

自 `1.7.3` 版本开始支持，该参考线终点在 y 轴的终点位置，可以配置 y 轴上的值，或者聚合计算类型，或者以回调的形式通过数据自行计算。

**注意该属性的使用场景为：**

1. 配合配置 x, y 和 y1 属性，用于在 x 轴上绘制 y 到 y1 范围的标注线
2. 配合配置 x，x1， y 和 y1 属性，为通过配置标注线两个端点 (x, y) 和 (x1, y1)

- 相对位置（string）：可以将 y 配置为 '15%' 百分比的形式，用于表示将 y 绘制在 marker 所在 region 纵轴（从上往下）的百分之 15 位置处。
- 聚合计算类型（string）
- 回调函数

### angle(string|number|function)

自`1.11.0`版本开始支持, 该参考线在极坐标系的 angle 轴上，可以配置 angle 轴上的值, 或者聚合计算，或者以回调的形式通过数据自行计算。

**注意该属性的使用场景为极坐标系下：**

1. 仅声明 angle 属性, 用于绘制分割整个极坐标系的 angle 轴
2. 配合配置 angle，radius 和 radius1 属性，用于在 angle 轴上绘制 radius 到 radius1 范围的标注线
3. 配合配置 radius，angle 和 angle1 属性，用于在 radius 轴上绘制 angle 到 angle1 范围的标注线
4. 配合配置 radius，radius1，angle 和 angle1 属性，用于在 radius 到 radius1， angle 到 angle1 范围的标注线

### radius(string|number|function)

自`1.11.0`版本开始支持, 该参考线在极坐标系的 radius 轴上，可以配置 radius 轴上的值, 或者聚合计算，或者以回调的形式通过数据自行计算。

**注意该属性的使用场景为极坐标系下：**

1. 仅声明 radius 属性, 用于绘制 radius 为某个属性值的整圆
2. 配合配置 angle，radius 和 radius1 属性，用于在 angle 轴上绘制 radius 到 radius1 范围的标注线
3. 配合配置 radius，angle 和 angle1 属性，用于在 radius 轴上绘制 angle 到 angle1 范围的标注线
4. 配合配置 radius，radius1，angle 和 angle1 属性，用于在 radius 到 radius1， angle 到 angle1 范围的标注线

### angle1(string|number|function)

自`1.11.0`版本开始支持, 该参考线在极坐标系的 angle 轴上，可以配置 angle 轴上的值, 或者聚合计算，或者以回调的形式通过数据自行计算。

**注意该属性的使用场景为极坐标系下：**

1. 仅声明 angle 属性, 用于绘制分割整个极坐标系的 angle 轴
2. 配合配置 angle，radius 和 radius1 属性，用于在 angle 轴上绘制 radius 到 radius1 范围的标注线
3. 配合配置 radius，angle 和 angle1 属性，用于在 radius 轴上绘制 angle 到 angle1 范围的标注线
4. 配合配置 radius，radius1，angle 和 angle1 属性，用于在 radius 到 radius1， angle 到 angle1 范围的标注线

### radius1(string|number|function)

自`1.11.0`版本开始支持, 该参考线在极坐标系的 radius 轴上，可以配置 radius 轴上的值, 或者聚合计算，或者以回调的形式通过数据自行计算。

**注意该属性的使用场景为极坐标系下：**

1. 仅声明 radius 属性, 用于绘制 radius 为某个属性值的整圆
2. 配合配置 angle，radius 和 radius1 属性，用于在 angle 轴上绘制 radius 到 radius1 范围的标注线
3. 配合配置 radius，angle 和 angle1 属性，用于在 radius 轴上绘制 angle 到 angle1 范围的标注线
4. 配合配置 radius，radius1，angle 和 angle1 属性，用于在 radius 到 radius1， angle 到 angle1 范围的标注线

{{ use: component-marker-aggregation-type() }}

### coordinates(Array)

标注目标：数据元素。
指定数据点的标注线。基于指定数据点进行标注线的绘制，可以对数据点进行数据处理。

**对于 `type: 'type-step'` 类型标注线，`coordinates` 的数组长度为 2，表示起始两个数据。**

{{ use: component-marker-data-point(
  prefix = '###'
) }}

#### process(Object)

数据点的处理方法。 如果不配置则按照 coordinate 数组直接连接成 line。

##### x(string)

对数据点基于 x 轴关联数据字段聚合处理。

{{ use: component-marker-aggregation-type() }}

##### y(string)

对数据点基于 y 轴关联数据字段聚合处理。

{{ use: component-marker-aggregation-type() }}

##### xy(string)

对数据点进行回归处理。

可选值：

- `'regression'`: 数据回归处理

{{ use: component-marker-data-point-offset(
   prefix = '##'
) }}

### positions(Array)

标注目标：坐标点。
指定坐标点的标注线。基于指定坐标点进行标注线的绘制。

**对于 `type: 'type-step'` 类型标注线，`positions` 的数组长度为 2，表示起始两个点。**

{{ use: component-marker-point-like(
  prefix = '###'
) }}

### regionRelative(boolean) = false

自 `1.7.0` 版本支持，仅对使用 `positions` 属性进行定位的情况生效，是否为相对 region 的坐标，默认为 false，即相对画布的坐标，默认 false。

{{ use: component-marker-axis(
  prefix = '##'
) }}

### line(Object)

标注线的线。

#### multiSegment(boolean) = false

当且仅当声明 `type: 'type-step'` 时生效，用于配置是否对 points 进行多段处理，默认为 false，即直接将所有的点连接成线。
如果需要进行多段处理，需要将 points 属性配置为 Point[][] 类型。

#### mainSegmentIndex(number)

当且仅当声明 `type: 'type-step'` 时生效，在 `multiSegment` 属性开启的前提下，用于声明那一段线段用来作为主线段，如果不声明，默认全段为主线段。

{{ use: component-marker-state(
  prefix = '###',
  graphicType = 'line'
) }}

#### style(Object|Array)

标注线的线样式。当进行多段配置时，可以通过数组的方式传入，或回调形式传入。

{{ use: component-marker-style-callback(
  description = '标注线样式'
) }}

{{ use: graphic-line(
  prefix = '####'
) }}

### label(Array|Object)

标注线的标签样式。
自 `1.13.9` 版本开始，支持配置多个标签。

#### position(Object)

标注线的标签位置（标签相对线的相对位置）。

可选值：

直角坐标系下:

- `'start'`: 线起点外侧
- `'middle'`: 线中点
- `'end'`: 线终点外侧
- `'insideStartTop'`: 线起点内侧上部
- `'insideStartBottom'`: 线起点内侧下部
- `'insideMiddleTop'`: 线中点上部
- `'insideMiddleBottom'`: 线中点下部
- `'insideEndTop'`: 线终点内侧上部
- `'insideEndBottom'`: 线终点内侧下部

极坐标系下:

- `'arcInnerStart'`: 弧线起点内侧
- `'arcInnerEnd'`: 弧线终点内侧
- `'arcInnerMiddle'` : 弧线中点内侧
- `'arcOuterStart'`: 弧线起点外侧
- `'arcOuterEnd'`: 弧线终点外侧
- `'arcOuterMiddle'`: 弧线中点外侧
- `'center'`: 弧线中心

可参考: https://echarts.apache.org/examples/zh/editor.html?c=line-markline&reset=1&edit=1

{{ use: component-marker-label(
  prefix = '###'
) }}

### startSymbol(Object)

参考线起点 symbol 样式

{{ use: component-marker-symbol(
  prefix = '###'
) }}

### endSymbol(Object)

参考线终点 symbol 样式

{{ use: component-marker-symbol(
  prefix = '###'
) }}

{{ use: component-marker-animation(
  prefix = '##',
  markerType = 'markLine',
  animationType = 'clipIn | fadeIn'
) }}
