{{ target: chart-map }}

# mapChart

地图

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'map'
) }}

{{ use: series-map(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true,
  noStack = true
) }}

{{ use: chart-component(
  noDataZoom = true,
  noCrosshair = true,
  regionType = 'geo'
) }}

##  mapLabel(Object)

地图标签的扩展组件。

### seriesId(string)

组件关联的系列 id。可以关联地图系列或者地理坐标系下的其他系列，例如散点地图中的散点系列。

### visible(boolean) = false

是否显示。

### nameField(string)

名称文本的数据字段。
### valueField(string)

数值文本的数据字段。

### trigger('hover'|'click'|'none') = 'none'

交互触发类型。

### offset(number) = 12

标签非 outer 位置下与标记点的像素间距。

### space(number) = 10

图标和文字之间的像素间距。

### position('top'|'bottom'|'left'|'right'|'outer') = 'top'

标签位置。

### nameLabel(object)

名称文本样式设置。
#### visible(boolean)

名称文本是否显示。

#### style(Object)

{{ use: mark-style(
  markName = 'nameLabel'
) }}

{{ use: graphic-text(
  prefix = '####'
) }}


### valueLabel(object)

数值文本样式设置。
#### visible(boolean)

数值文本是否显示。

#### style(Object)

{{ use: mark-style(
  markName = 'valueLabel'
) }}

{{ use: graphic-text(
  prefix = '####'
) }}

### icon(object)

图标样式设置。

#### visible(boolean)

图标是否显示。

#### style(Object)

{{ use: mark-style(
  markName = 'icon'
) }}

{{ use: graphic-text(
  prefix = '####'
) }}

### background(object)

背景样式设置。

#### visible(boolean)

背景是否显示。

#### padding(Object|number) = { top: 4, bottom: 4, left: 6, right: 6 }

背景框的 padding 设置。支持直接设置数值，也可以通过对象类型分别为上下左右方向配置。

- number：单位为 px，上下左右四个方向同时配置
- Object：对象类型使用如下

{{ use: common-layout-padding(
  prefix = '####',
) }}

#### style(Object)

{{ use: mark-style(
  markName = 'background'
) }}

{{ use: graphic-rect(
  prefix = '####'
) }}

### leader(object)

引导线样式设置。

#### visible(boolean)

引导线是否显示。

#### style(Object)

{{ use: mark-style(
  markName = 'leader'
) }}

{{ use: graphic-path(
  prefix = '####'
) }}
