{{ target: series-link }}

<!-- ILinkSeriesSpec -->

**link 系列**，可用于绘制时序图，需要配合dot 系列使用。**仅适用于直角坐标系**。

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'link',
) }}

#${prefix} fromField(string)

起点字段，用于绘制link的起点。
注: 该字段提供的数据需要和被关联的dot 系列中的nameField字段提供的数据保持一致，起点的定位跟随dot 系列的节点。

#${prefix} toField(string)
终点字段，用于绘制link的终点。
注: 该字段提供的数据需要和被关联的dot 系列中的nameField字段提供的数据保持一致，终点的定位跟随dot 系列的节点。

#${prefix} dotSeriesIndex(number)

被关联的dot 系列索引。

#${prefix} dotTypeField(string)

被关联的事件类型。用于区分link的stroke逻辑。如果没有配置，则每条link都使用相同的stroke。


#${prefix} link(Object)
线图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'link'
) }}

{{ use: mark-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} arrow(Object)

arrow 图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'arrow'
) }}

{{ use: mark-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}