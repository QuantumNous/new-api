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

Name dimension field.

#${prefix} valueField(String)

Value dimension field.

#${prefix} aspectRatio(number)=1.618

Rectangle split ratio, default is `(1 + Math.sqrt(5)) / 2`

#${prefix} splitType(string)='binary'

Rectangle split method. Optional values:

- `'binary'`: Recursively splits the specified node into an approximately balanced binary tree, choosing horizontal splits for wide rectangles and vertical splits for tall rectangles.
- `'dice'`: Horizontally divides the rectangular area specified by x0, y0, x1, and y1 based on the value of each child node of the specified node. Child nodes are positioned sequentially, starting from the left edge (x0) of the given rectangle. If the sum of child node values is less than the value of the specified node (that is, if the specified node has a non-zero internal value), the remaining empty space will be positioned at the right edge (x1) of the given rectangle.
- `'slice'`: Similar to `'dice'`, the direction is to split vertically.
- `'sliceDice'`: Nodes have odd depth, use `'slice'`; nodes have even depth, use 'dice'.
- `'squarify'`: The rectangle is divided as much as possible according to a specific aspect ratio.

#${prefix} gapWidth(number|number[]) = 1

The spacing between two sibling nodes supports two configurations:

1. `number`: Configure the same spacing for different layer nodes;
2. `number[]`: `number[i]` represents the spacing between nodes at the `ith` level.

#${prefix} nodePadding(number|number[]) = [5]

Layer margin supports two configurations:

1. `number`: Configure the same margin;
2. `number[]`: `number[i]` represents the margin for the `ith` layer node.

#${prefix} maxDepth(number)

The maximum level to display. When a node's depth in the hierarchical data is greater than maxDepth, the node will not be displayed.

#${prefix} minVisibleArea(number)=10

When the area size (px \* px) is smaller than the set value, the node will be hidden.

#${prefix} minChildrenVisibleArea(number)

When the area size (px \* px) is smaller than the set value, the child nodes of the node will be hidden.

#${prefix} roam(boolean)=false

Enable dragging and scaling.

<!-- Drill down -->

{{ use: common-drill(
  prefix = ${prefix}
) }}

#${prefix} leaf(Object)

Leaf node graphic style settings.

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

Non-leaf node graphic style settings.

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

Label configuration.

The labels of the leaf nodes in the treemap are displayed in the center of the rectangle by default. You can customize the label positions by referring to the [example](/vchart/demo/treemap-chart/treemap-show-parent-level).

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
  hasOverlap = false,
) }}

#${prefix} nonLeafLabel(Object)

Non-leaf node label style settings, hidden by default.

##${prefix} position('top'|'bottom'|'left'|'right')='top'

Non-leaf node label display position.

##${prefix} padding(number)

The desired non-leaf node label space. When there is not enough space for the label to display, this configuration is ineffective.

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}

Map element label style settings.
