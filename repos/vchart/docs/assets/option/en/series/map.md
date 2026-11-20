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

Map data source.
The name of the map data registered through the `registerMap` interface, for example:

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

Name dimension field.

#${prefix} valueField(string)

Value dimension field.

#${prefix} nameProperty(string)='name'

Geographic name field in map data.

#${prefix} nameMap(Object)

The mapping relationship between the geographic names in the map data and the names in the data, used when the names in the map data and the data are inconsistent.

For example: The geographic name in the map data is `广东省`, and the name in the data is `广东`. Then the `nameMap` can be configured as:

```json
{ "广东省": "广东" }
```

#${prefix} defaultFillColor(string) = '#f3f3f3'

Default map fill color. When there is no corresponding geographic name data in the chart data, use this color to fill the map.

#${prefix} centroidProperty(string)

Supported since version `1.5.1`.
Center longitude and latitude coordinates fields in the geography area of map data. The default center coordinate is automatically generated when registering map data (registerMap).
For example, if the centroid field is present in the map data, you can configure `centroidProperty: 'centroid'` in the map series.

```json
"properties":{
  "centroid": [117.35675, 39.282806]
}
```

#${prefix} showDefaultName(boolean)=false
Supported since version `1.10.3`.

Whether to show the default names from the map data for unmatched areas in nameMap.

#${prefix} area(Object)

Map graphic style settings.

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

Label configuration.

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}
