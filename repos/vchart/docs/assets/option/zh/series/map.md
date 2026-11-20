{{ target: series-map }}

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  seriesType = 'map',
  seriesMarks = ['area'],
  noMorph = ${noMorph},
  noStack = ${noStack},
  useInChart = ${useInChart}
) }}

#${prefix} map(string)

地图数据源。
通过 `registerMap` 接口注册的地图数据名称，例如：

```ts
// 注册了名为 `china` 的地图数据
vchart.registerMap('china', chinaGeojson);
// 可以在 spec 中配置 map: 'china' 来使用该地图数据
{
  type: 'map',
  map: 'china',
  ...
}
```

#${prefix} nameField(string)

名称维度字段。

#${prefix} valueField(string)

数值维度字段。

#${prefix} nameProperty(string)='name'

地图数据中的地理名称字段。

#${prefix} nameMap(Object)

地图数据中的地理名称与数据中的名称映射关系，用于地图数据与数据中的名称不一致时使用。

例如：地图数据中的地理名称为`广东省`，而数据中的名称为`广东`，则可以配置`nameMap`为:

```json
{ "广东省": "广东" }
```

#${prefix} defaultFillColor(string) = '#f3f3f3'

地图默认填充色。当图表数据中没有对应地理名称的数据时，使用该颜色填充地图。

#${prefix} centroidProperty(string)

从 1.5.1 版本开始支持。
地图数据中的地理区域中心经纬度坐标字段。默认中心坐标在注册地图数据(registerMap)时自动生成。
例如，地图数据中有如下 `centroid` 字段，则可在地图系列中配置 `centroidProperty: 'centroid'`

```json
"properties":{
  "centroid": [117.35675, 39.282806]
}
```

#${prefix} showDefaultName(boolean)=false

从 1.10.3 版本开始支持。

nameMap未匹配成功区域是否显示地图数据内的默认名称。

#${prefix} area(Object)

地图图元样式设置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'area'
) }}

{{ use: mark-path(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

<!-- area mark end -->

#${prefix} label(Object)

标签配置。

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}
