{{ target: series-treemap }}

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  isHierarchy = true,
  seriesType = 'treemap',
  seriesMarks = ['leaf','nonLeaf'],
  noMorph = ${noMorph},
  noStack = ${noStack},
  useInChart = ${useInChart},
  preset = 'growIn' + '|' + 'fadeIn',
  defaultPreset = 'growIn'
) }}

#${prefix} categoryField(String)

名称维度字段。

#${prefix} valueField(String)

数值维度字段。

#${prefix} aspectRatio(number)=1.618

矩形分割比例，默认为`(1 + Math.sqrt(5)) / 2`

#${prefix} splitType(string)='binary'

矩形分割方式。可选值：

- `'binary'`: 递归地将指定的节点分割成一个近似平衡的二叉树，对宽的矩形选择水平分割，对高的矩形选择垂直分割。
- `'dice'`: 根据指定节点的每个子节点的值水平划分由 x0, y0, x1, y1 指定的矩形区域。子节点按顺序定位，从给定矩形的左边缘（x0）开始。如果子节点的值之和小于指定节点的值（即，如果指定节点有一个非零的内部值），剩余的空位将被定位在给定矩形的右边缘（x1）。
- `'slice'`: 和`'dice'`类似，方向为竖直方向分割。
- `'sliceDice'`: 节点奇数深度，用`'slice'`；节点偶数深度，用'dice'。
- `'squarify'`: 尽可能按照一个特定长宽比的分割矩形。

#${prefix} gapWidth(number|number[]) = 1

两个同层级节点之间的间距，支持两种配置方式：

1. `number`: 不同层节点的配置相同间距；
2. `number[]`: `number[i]` 表示第 `i` 层节点之间的间距。

#${prefix} nodePadding(number|number[]) = [5]

层级边距，支持两种配置方式：

1. `number`: 配置相同边距；
2. `number[]`: `number[i]` 表示第 `i` 层节点的边距。

#${prefix} maxDepth(number)

展示的最大层级。 当节点在层次数据中的深度大于 maxDepth 时，节点将不会被显示。

#${prefix} minVisibleArea(number)=10

当区域面积（px \* px）小于设定值后，节点将被隐藏。

#${prefix} minChildrenVisibleArea(number)

当区域面积（px \* px）小于设定值后，节点的子节点将被隐藏。

#${prefix} roam(boolean)=false

是否开启拖拽和缩放。

<!-- 下钻 -->

{{ use: common-drill(
  prefix = ${prefix}
) }}

#${prefix} leaf(Object)

叶子节点图元样式设置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'leaf'
) }}

{{ use: mark-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

<!-- leaf mark end -->

#${prefix} nonLeaf(Object)

非叶子节点图元样式设置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'nonLeaf'
) }}

{{ use: mark-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

<!-- nonLeaf mark end -->

#${prefix} label(Object)

标签配置。

矩形树图叶节点标签默认在矩形居中位置显示，自定义标签位置可以参考[示例](/vchart/demo/treemap-chart/treemap-show-parent-level)

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
  hasOverlap = false,
) }}

#${prefix} nonLeafLabel(Object)

非叶子节点标签样式配置，默认不显示。

##${prefix} position('top'|'bottom'|'left'|'right')='top'

非叶子节点标签展示位置。

##${prefix} padding(number)

期望的非叶子节点标签空间。当空间不足以显示标签时，该配置不生效。

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}

地图图元标签样式设置。
