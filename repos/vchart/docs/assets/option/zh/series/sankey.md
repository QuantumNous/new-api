{{ target: series-sankey }}

<!-- ISankeySeriesSpec -->

**桑基图系列**

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  isHierarchy = true,
  seriesType = 'sankey',
  seriesMarks = ['node','link'],
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  preset = 'growIn' + '|' + 'fadeIn',
  defaultPreset = 'growIn'
) }}

#${prefix} node(Object)

node 节点样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'node'
) }}

{{ use: mark-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} link(Object)

边配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'link'
) }}

{{ use: mark-link-path(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} categoryField(string)

节点名称字段。

#${prefix} valueField(string)

节点之间关系的权重字段。

#${prefix} sourceField(string)

来源节点数据字段。
层级数据无须提供。

#${prefix} targetField(string)

目标节点数据字段。
层级数据无须提供。

#${prefix} direction(string) = 'horizontal'

图表布局方向。

可选：

- `vertical`
- `horizontal`

#${prefix} nodeAlign(string)

节点的对齐类型，按照节点的深度，计算对齐方式，决定了节点在第几层：

- 横向布局的桑基图，用于计算节点 x 坐标
- 纵向布局的桑基图，用于计算节点 y 坐标

可选：

- `left`
- `right`
- `center`
- `justify`
- `start`
- `end`

#${prefix} crossNodeAlign(string)

自 **1.12.4**版本开始支持

横向布局的桑基图，设置节点 Y 坐标的对齐方式：

- 'start' - '顶部对齐'
- 'end' - '底部对齐'
- 'middle' - '居中对齐'
- 'parent' - '父节点对齐'，自 **1.12.14**版本开始支持
-
- 纵向布局的桑基图，设置节点 X 坐标的对齐方式：
- 'start' - '左对齐'
- 'end' - '右对齐'
- 'middle' - '居中对齐'
- 'parent' - '父节点对齐'，自 **1.12.14**版本开始支持

#${prefix} inverse(boolean)

自版本**1.12.2**开始支持
反向展示，节点和边整体反向展示
对于布局方向为`horizontal`的桑基图，默认是节点从左往右展示；设置`inverse: true`，节点从右往左展示；
对于布局方向为`vertical`的桑基图，默认是节点从上到下展示；设置`inverse: true`，节点从下到上展示；

#${prefix} nodeGap(number)

同一层中两个节点之间的间隙大小。

#${prefix} nodeWidth(string|number|Function)

每个节点的宽度，支持三种取值

- 1. 百分比字符串，例如：{ nodeWidth: '12%' }
- 2. 以'px'为单位的简单数字，eg: { nodeWidth: 20 }
- 3. Function，通过自定义计算指定 nodeWidth

#${prefix} linkWidth(number|Function)

边宽度。
单位 px。

#${prefix} minStepWidth(number)

节点与边的最小宽度总和

#${prefix} minNodeHeight(number)

数据不为零或空时节点的最小大小。

- 这个配置可以用来避免数据太小时看不到太细的节点
- 建议小于 5px

#${prefix} maxNodeHeight(number)

自`1.12.14`版本开始支持

数据不为零或空时节点的最大大小。

#${prefix} minLinkHeight(number)

数据不为零或空时边的最小大小。

- 这个配置可以用来避免数据太小的时候看不到太细的链接
- 建议小于 5px
- 当同时指定 `minNodeHeight` 和 `minLinkHeight` 两个选项时，此选项应小于 `minNodeHeight`

#${prefix} maxLinkHeight(number)

自`1.12.14`版本开始支持

数据不为零或空时边的最小大小。

- 当同时指定 `minNodeHeight` 和 `minLinkHeight` 两个选项时，此选项应小于 `minNodeHeight`

#${prefix} iterations(number)

布局的迭代次数。

#${prefix} nodeKey(string|number|Function)

解析节点的 key 值。

#${prefix} linkSortBy(Function)

按此 funtion 排序边。

#${prefix} nodeSortBy(Function)

按此 funtion 排序节点。

#${prefix} setNodeLayer(Function)

自定义指定节点层。

#${prefix} dropIsolatedNode(Boolean)

自`1.11.0` 版本开始支持
是否丢弃孤立的节点

#${prefix} nodeHeight(number | function)

自`1.11.0` 版本开始支持
给节点设置指定的高度（布局方向为`vertical`时，对应了宽度）

#${prefix} linkHeight(number | function)

自`1.11.0` 版本开始支持
给边设置指定的高度（布局方向为`vertical`时，对应了宽度）

#${prefix} equalNodeHeight(boolean)

自`1.11.0` 版本开始支持
给所有的节点设置统一的高度（布局方向为`vertical`时，对应了宽度），根据画布高度以及节点的个数，自定计算;

#${prefix} linkOverlap('start' | 'center' | 'end')

自`1.11.0` 版本开始支持
当设置了该配置，同一节点下的不同边按照重叠的方式布局：

- 'start' 所有的边和节点的起点重合
- 'center' 所有的边和节点的中间点重合
- 'end' 所有的边和节点的终点重合

#${prefix} emphasis(Object)

联动交互配置。

##${prefix} enable(boolean) = true

是否开启交互。

##${prefix} trigger(string) = 'click'

交互触发类型。

可取：

- `click`
- `hover`

##${prefix} effect(string) = 'self'

交互联动效果。
桑基图提供 3 种在节点上的交互联动效果:

- `self`: 仅高亮当前节点。
- `adjacency`: 高亮当前节点上下游节点和关联的边，淡化其它图形元素。
- `related`： 高亮与当前节点相关的整条路径上的节点和边，淡化其它图形元素。

#${prefix} overflow(string)

自 `1.13.0`版本开始支持

当指定了节点、边的宽度的时候，可以配置这个属性，实现当宽度大于图表 region 的宽度或者高度大于图表 region 高度的时候是否自动产生滚动条

支持的配置如下：

- 'scroll' 根据 x 方向和 y 方向自动生成滚动条
- 'hidden' 默认不产生滚动条
- 'scroll-x' x 方向自动生成滚动条
- 'scroll-y' y 方向自动生成滚动条
