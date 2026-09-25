# 地图

[\[配置项手册\]](../../../option/mapChart)

## 简介

地图是一种将数据可视化为区域颜色或填充效果以显示地理位置的图表类型。通常，地图图表会使用行政边界图层或地图瓦片作为基础地图，并使用颜色或填充级别来表示特定区域的数据值。

## 图表构成

地图主要由形似地理区域的 path 图元及标签等元素构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/b42a7699efcd4dfa8b8aa3a02.png)

形似地理区域的 path 图元为地图的基本要素，相关的绘制配置必不可少:

- `mapChart.type`: 图表类型，地图的类型为`'map'`
- `mapChart.nameField`: 分类字段，映射 path 图元所表示的地理区域
- `mapChart.valueField`: 数值字段，映射 path 图元的颜色

由于绘制地理区域需要地图数据的支持，所以地图数据的配置同样必不可少:

- `VChart.registerMap(mapName, mapData)`: VChart 提供地图数据注册的 api，其中`mapName`表示注册的地图数据名称，`mapData`指具体的地图数据，默认为`geojson`类型地图数据，也支持`topojson` 类型地图数据。
- `mapChart.map`: 指定使用注册的地图数据名称

更多地图相关配置见[地图](../../../option/mapChart)

## 快速上手

```javascript livedemo
const spec = {
  type: 'map',
  map: 'world'
};

const geosjonUrl = 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/geojson/world.json';

const response = await fetch(geosjonUrl);
const geojson = await response.json();

VChart.registerMap('world', geojson, {
  type: 'geojson'
});

const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();
```

## 地图特性

### 数据

在地图中需要两份数据：

1. 地图底图数据
   地图图表的最基本元素是地图底图，加载地图分为 3 步：

- 获取远程底图数据，比如：`await fetch(xxx)`
- 注册地图数据，比如:

```ts
VChart.registerMap('china', china_topojson, {
  type: 'topojson',
  object: 'china'
});
```

VChart 提供地图数据注册的 api`VChart.registerMap(mapName, mapData)`，其中`mapName`表示注册的地图数据名称，`mapData`指具体的地图数据，默认为`geojson`类型地图数据，也支持`topojson` 类型地图数据，如下面的例子。

- 指定使用注册的地图数据名称，比如`VChart.map: 'mapName'`

```javascript livedemo
const spec = {
  type: 'map',
  map: 'south-america',
  nameField: 'name',
  valueField: 'value',
  data: [
    {
      id: 'map',
      values: [
        {
          name: 'Peru',
          value: 247300
        },
        {
          name: 'Chile',
          value: 244500
        },
        {
          name: 'Brazil',

          value: 1993000
        },
        {
          name: 'Bolivia',
          value: 1653000
        },
        {
          name: 'Argentina',
          value: 1553000
        },
        {
          name: 'Paraguay',
          value: 1253000
        },
        {
          name: 'Venezuela',
          value: 1153000
        },
        {
          name: 'Colombia',
          value: 1053000
        }
      ]
    }
  ]
};

const topojsonUrl = 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/topojson/south-america.json';

const response = await fetch(topojsonUrl);
const topojson = await response.json();

VChart.registerMap('south-america', topojson, {
  type: 'topojson',
  object: 'south-america'
});

const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();
```

### rewind

在地理信息系统（GIS）和地图可视化开发中，**Rewind**（重绕/回绕）是一个用于**修正多边形（Polygon）顶点顺序（Winding Order）**的关键操作。

简单来说，它的作用是确保多边形的“外环”和“内环（洞）”按照标准规定的方向（顺时针或逆时针）排列，以防止渲染引擎在绘图时出现严重的视觉错误。

一般来说，如果传入地图数据没有报错，映射也配置正确，但是绘图效果不符合预期时，那就有可能是地图数据的顶点顺序（Winding Order）不符合预期，导致渲染引擎绘制错误。

在这种情况下，就需要对地图数据进行 Rewind 操作，确保多边形的“外环”和“内环（洞）”按照标准规定的方向（顺时针或逆时针）排列。vchart 在注册地图的参数值中有提供 rewin 选项，默认为 false。

```
// topojson 数据开启 rewind 选项
VChart.registerMap('south-america', topojson, {
  type: 'topojson',
  object: 'south-america',
  rewind: true
});

// geojson 数据开启 rewind 选项
VChart.registerMap('world', world_geojson, {
  type: 'geojson',
  rewind: true
});
```

2. 图元映射数据

- 一个`地理维度`字段，用于指定需要在底图上着色的区域
- 一个`数值`字段，用于映射着色的深浅等指定的视觉通道
  注意: 如果传入的地理维度字段中的区域名称与底图数据不对应，需要通过`mapChart.nameMap`指定。

### 指定 nameMap

正如上文所说，如果图元映射数据中的区域名称与底图数据不对应，需要通过`mapChart.nameMap`指定。
比如在[基础地图](../../../demo/map-chart/basic-map)的例子中，图元映射数据中的区域名称不带行政单位，但底图数据中是有的，所以需要配置`mapChart.nameMap`。

### 自定义映射

地图默认使用离散着色的方式对每个区域进行着色，也就是每个区域的颜色没有连续性。但在很多场景下，地图区域需要通过着色深浅来表示数值大小，从而方便快速找出异常值。
在 VChart 中，可以通过自定义颜色映射的方式达到这一目的。

```ts
color: {
    type: 'linear',
    range: ['rgb(252,250,97)', 'rgb(252,150,134)', 'rgb(87,33,15)']
  }
```

```javascript livedemo
const spec = {
  type: 'map',
  map: 'south-america',
  nameField: 'name',
  valueField: 'value',
  color: {
    type: 'linear',
    range: ['rgb(252,250,97)', 'rgb(252,150,134)', 'rgb(87,33,15)']
  },
  area: {
    style: {
      fill: {
        scale: 'color',
        field: 'value',
        changeDomain: 'replace'
      }
    }
  },
  data: [
    {
      id: 'map',
      values: [
        {
          name: 'Peru',
          value: 247300
        },
        {
          name: 'Chile',
          value: 244500
        },
        {
          name: 'Brazil',

          value: 1993000
        },
        {
          name: 'Bolivia',
          value: 1653000
        },
        {
          name: 'Argentina',
          value: 1553000
        },
        {
          name: 'Paraguay',
          value: 1253000
        },
        {
          name: 'Venezuela',
          value: 1153000
        },
        {
          name: 'Colombia',
          value: 1053000
        }
      ]
    }
  ]
};

const topojsonUrl = 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/topojson/south-america.json';

const response = await fetch(topojsonUrl);
const topojson = await response.json();

VChart.registerMap('south-america', topojson, {
  type: 'topojson',
  object: 'south-america'
});

const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();
```

### 自定义投影

可以在地图区域配置`projection: type`来配置地图投影类型，具体配置项可以参考[配置项文档](../../../option/mapChart#region.projection.type)。

```javascript livedemo
const spec = {
  type: 'map',
  map: 'world',
  nameField: 'name',
  valueFiled: 'value',
  region: [
    {
      projection: {
        type: 'equirectangular'
      }
    }
  ],
  data: [
    {
      name: 'source',
      values: [
        {
          name: 'China',
          value: 21197
        }
      ]
    }
  ]
};

const geosjonUrl = 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/geojson/world.json';

const response = await fetch(geosjonUrl);
const geojson = await response.json();

VChart.registerMap('world', geojson, {
  type: 'geojson'
});

const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();
```

### 交互

地图支持缩放和拖拽的交互，可以在地图区域配置`roam: true`开启交互，缩放大小也可以通过配置`zoomLimit`来限制：

```json
{
  "region": [
    {
      "roam": true,
      "coordinate": "geo",
      "zoomLimit": {
        "min": 1,
        "max": 6
      }
    }
  ]
}
```

下面是地图缩放交互的示例：

```javascript livedemo
const spec = {
  type: 'map',
  map: 'world',
  nameField: 'name',
  valueFiled: 'value',
  region: [
    {
      roam: true,
      zoomLimit: {
        min: 1,
        max: 6
      },
      projection: {
        type: 'equirectangular'
      }
    }
  ],
  data: [
    {
      name: 'source',
      values: [
        {
          name: 'China',
          value: 21197
        }
      ]
    }
  ]
};

const geosjonUrl = 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/geojson/world.json';

const response = await fetch(geosjonUrl);
const geojson = await response.json();

VChart.registerMap('world', geojson, {
  type: 'geojson'
});

const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();
```

# 免费获取地图数据

注意：请确定地图数据是否符合标准的`右手规则`，否则可能会导致渲染不符合预期。如果不符合标准，需要使用上面提到的 **rewind** 选项来处理。

## 中国地图数据

可以从这些网站获取中国地图数据：

- [geojson.cn](https://geojson.cn/data/atlas/china)
- [cloudcenter.tianditu.gov.cn](https://cloudcenter.tianditu.gov.cn/administrativeDivision)
- [datav.aliyun.com](https://datav.aliyun.com/portal/school/atlas/area_selector)
  需要提醒的是，上线的地图都需要经过有关部分进行审核，否则会有法律风险。

## 世界地图数据

可以从这些网站获取世界地图数据：

- [hub.arcgis.com](https://hub.arcgis.com/search)
- [geojson-maps.kyd.au](https://geojson-maps.kyd.au/)

## 在线编辑工具：

可以通过这些网站编辑地图数据，处理 GeoJson 格式文件：

- [geojson.io](https://geojson.io/) - 在线创建、编辑、查看 GeoJSON
- [mapshaper.org](https://mapshaper.org/) - 地图数据编辑和格式转换
- [leafletjs.com](https://leafletjs.com/) - Leaflet 地图库官网
- [geoman.io](https://geoman.io/) - 地图几何编辑工具
