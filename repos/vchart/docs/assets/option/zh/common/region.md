{{ target: common-region }}

<!-- IRegionSpec -->

## region(Array)

region 配置

<!-- 图表布局配置 -->
<!-- IRegionSpec -->

### id(string|number)

region 的 id，可以在其他功能模块中使用这个 id 来索引这个 region。

{{ var: defaultCoordinate = ${regionType} === 'geo' ? 'geo' : ${axisType} }}

### coordinate(string) = '${defaultCoordinate}'

坐标系类型

可选值：

- `'cartesian'`: 笛卡尔坐标系
- `'polar'`: 极坐标系
- `'geo'`: 地理坐标系

{{ if: ${regionType} === 'geo' }}

### roam(boolean|Object) = false

是否可以拖拽和缩放。
自 `1.12.8` 版本后，支持配置 `roam.blank: true` 来开启 region 空白区域的拖拽。

### longitudeField(string)

数据中的经度字段名，通常用于 `common` 图表中非地图系列组合时的数据字段制定。

### latitudeField(string)

数据中的纬度字段名，通常用于 `common` 图表中非地图系列组合时的数据字段制定。

### projection(string)

地理相关映射配置

#### type(string) = 'mercator'

地理映射类型。内置投影类型如下：

- `albers`：埃尔伯投影，默认以美国为中心，中心在 Hutchinson。
- `albersUsa`：复合投影，用来显示美国下部 48，不支持旋转或居中操作。
- `azimuthalEqualArea`：方位角等面积投影，保持要素的真实相对大小。
- `azimuthalEquidistant`：方位角等距投影，保留了精确的中心点距离和方向。
- `conicConformal`：等角二次曲线投影，属于锥型投影，适用于中纬度地区。
- `conicEqualArea`：埃尔伯等积圆锥投影，标准纬线之间的区域中变形很小。
- `conicEquidistant`：等距圆锥投影，沿经线方向，所有圆形纬线的间距相等。
- `equalEarth`：等积伪圆柱投影，纬线是平行直线，适于绘制小比例地图。
- `equirectangular`：等距柱状投影，计算简便，但南北极拉伸较大，失真严重。
- `gnomonic`：球心投影，将地心作为透视点，无法同时投影热带和两极。
- `mercator`：墨卡托投影，离极点越近纬度间距越大，无法表示极点。
- `naturalEarth1`：自然地球投影，没有经度上的面积畸变。
- `orthographic`：正投影，较适于显示单个半球的方位投影。
- `stereographic`：立体投影，等角，局部形状精确，但通常仅限一个半球。
- `transverseMercator`：横轴墨卡托投影，可最大程度内减少感兴趣区的变形。

#### zoom(number) = 1

初始化缩放倍数。

#### center([number, number])

初始化聚焦的经纬度。

### zoomLimit(object)

缩放最大最小倍数限制。

#### min(number)

缩放最小倍数限制，默认无限制。

#### max(number)

缩放最大倍数限制，默认无限制。
{{ /if}}

### style(Object)

背景样式设置。

{{ use: graphic-rect(
  prefix = '###'
) }}

### stackInverse(boolean)

从 `1.4.0` 版本开始支持，是否在堆积时逆序。

### stackSort(boolean)

从 `1.10.4` 版本开始支持，是否在堆积时对数据排序。

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'region',
  defaultLayoutLevel = 10,
  defaultLayoutZIndex = 450,
  isRegion = true,
) }}
