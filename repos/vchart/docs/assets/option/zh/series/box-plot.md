{{ target: series-box-plot }}

<!-- IBoxPlotSeriesSpec -->

**箱型图系列**，可用于绘制箱型图。**仅适用于直角坐标系**。

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  noStack = true,
  noInvalidType = true,
  useInChart = ${useInChart},
  seriesType = 'boxPlot',
  seriesMarks = ['boxPlot', 'symbol'],
  noPreset = true
) }}

#${prefix} minField(string)

箱型图最小值字段。

#${prefix} q1Field(string)

箱型图 Q1（下四分位数，又称“较小四分位数”，等于该样本中所有数值由小到大排列后第 25%的数字）字段。q1Field 与 q3Field 同时为空，则不绘制箱体。

#${prefix} medianField(string)

箱型图 Q2（中位数，等于该样本中所有数值由小到大排列后第 50%的数字）字段。为空则不绘制箱体上的中位数标记。

#${prefix} q3Field(string)

箱型图 Q3（上四分位数，又称“较大四分位数”，等于该样本中所有数值由小到大排列后第 75%的数字）字段。q1Field 与 q3Field 同时为空，则不绘制箱体。

#${prefix} maxField(string)

箱型图最大值字段。

#${prefix} outliersField(string)

箱型图异常值字段。

#${prefix} boxPlot(Object)

boxPlot 图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)
boxPlot 图元样式配置。
{{ use: mark-box-plot(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} outliersStyle(Object)
箱型图异常点样式配置。

##${prefix} fill(string)
异常点填充颜色，为空则跟随箱型图颜色。

##${prefix} size(number) = 10
异常点大小。
