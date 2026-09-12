{{ target: component-linear-axis }}

<!-- ILinearAxisSpec -->

#${prefix} min(number)

**仅当轴为线性轴或时间轴时生效**，最小值(时间轴仅支持时间戳)，**优先级高于 zero，nice**。

#${prefix} max(number)

**仅当轴为线性轴或时间轴时生效**，最大值(时间轴仅支持时间戳)，**优先级高于 zero，nice**。

#${prefix} softMin(number)

自**1.11.0**版本开始支持

**仅当轴为线性轴或时间轴时生效**，最小值(时间轴仅支持时间戳)，当且仅当该值小于数据最小值时，才能生效，**优先级高于 zero，nice**。

- 注意：不建议和配置`min`一起使用

#${prefix} softMmax(number)

自**1.11.0**版本开始支持

**仅当轴为线性轴或时间轴时生效**，最大值(时间轴仅支持时间戳)，当且仅当该值大于数据最大值时，才能生效，**优先级高于 zero，nice**。

注意：不建议和配置`max`一起使用

#${prefix} nice(boolean) = true

**仅当轴为线性轴或时间轴时生效**，是否根据数据将轴范围调整到相对规整的数值，当配置了 `min` 和 `max`，该配置项失效。

比如当配置了 `max = 999`, `nice` 并不会将轴范围优化到 1000。

#${prefix} niceType(string) = 'tickCountFirst'

**仅当轴为线性轴或时间轴时生效**，nice 效果的类型，是精度优先还是 tickCount 优先（比如 tickCount 为 2 那 nice 出来的精度就很低）。不配置就默认是 tickCountFirst。

可选值：

- `'tickCountFirst'`
- `'accurateFirst'`

举例：数据范围是 0~6000，如果 tickCount 为 2，那么 `tickCountFirst` 出来的 range 就是[0, 10000], `accurateFirst` 出来的 range 就是[0, 6000]但 10000 显示不了。

#${prefix} zero(boolean) = true

**仅当轴为线性轴或时间轴时生效**，是否包含 0 值。当配置了 min 和 max，该配置项失效。

#${prefix} expand(Object)

**仅当轴为线性轴或时间轴时生效**，轴范围按比例扩展，当配置了 min 和 max，该配置项失效。

##${prefix} min(number)

轴范围按比例扩展的最小值。

##${prefix} max(number)

轴范围按比例扩展的最大值。

#${prefix} sync(Object)

使当前轴与其他轴同步

##${prefix} axisId(number)

同步的另一个轴的 id

##${prefix} zeroAlign(number)

保持 2 个轴的 0 值对齐

##${prefix} tickAlign(number)

使这个轴的 tick 与目标轴保持比例对齐

#${prefix} tooltipFilterRange(number | [number, number] | (({ scale: IBaseScale }) => number | [number, number]))

**仅当轴为线性轴或时间轴时生效**，配置连续轴上的 dimension tooltip 数据筛选范围。从 1.4.0 版本开始支持。

如果配置为单个数字形如 `d`，则筛选区间为 `[x0 - d, x0 + d]`；如果配置为二元组形如 `[d1, d2]`，则筛选区间为 `[x0 + d1, x0 + d2]`。

如果配置为函数 `f`, 函数的返回值将会作为数据筛选范围的值。

#${prefix} breaks(Array|Object)

自 `1.12.4` 版本开始支持。

轴截断配置，只对笛卡尔坐标系的 linear 轴生效。

##${prefix} range(number[])

轴截断的数据范围，如 `[300, 500]`，请确保数据范围的大小顺序，否则会被视为无效配置。

##${prefix} breakSymbol(Object)

截断图形样式配置。

###${prefix} visible(boolean)

是否显示，默认为 `true`。

###${prefix} gap(number | string)

截断标识之间的间距配置，默认为 `6`。

- 1. `number` 为像素值
- 2. `string` 为百分比相对值，如 '1%'

###${prefix} angle(number)

截断图形旋转的角度配置。

###${prefix} style(Object)

截断图形的样式配置，可以配置线宽(`lineWidth`)、颜色(`stroke`)等。
