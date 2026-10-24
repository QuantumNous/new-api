{{ target: component-marker-axis }}

#${prefix} startRelativeSeriesIndex(number)

起点关联的series索引（仅在标注目标：坐标空间下有效）。

#${prefix} startRelativeSeriesId(string)

起点关联的series ID（仅在标注目标：坐标空间下有效）。

#${prefix} endRelativeSeriesIndex(number)

终点关联的series索引（仅在标注目标：坐标空间下有效）。

#${prefix} endRelativeSeriesId(string)

终点关联的series ID（仅在标注目标：坐标空间下有效）。

#${prefix} relativeRelativeSeriesIndex(number)

被标注数据关联的series索引（默认使用当前region第一个有效series）。

#${prefix} relativeRelativeSeriesId(string)

被标注数据关联的series ID（默认使用当前region第一个有效series）。

#${prefix} specifiedDataSeriesIndex(string|number|array)
自`1.11.0`版本，数据处理需要单独关联系列, 当配置为'all'时代表关联当前region下所有系列。

#${prefix} specifiedDataSeriesId(string|number|array)
自`1.11.0`版本，数据处理需要单独关联系列, 当配置为'all'时代表关联当前region下所有系列。