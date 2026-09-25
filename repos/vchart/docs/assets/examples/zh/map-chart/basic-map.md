---
category: examples
group: map chart
title: 基础地图
keywords: map,space,polygon
order: 11-0
cover: /vchart/preview/basic-map_1.9.1.png
option: mapChart
---

# 基础地图

## 关键配置

- 指定图表表类型`type: map`为地图
- `nameField` 指定分类字段
- `valueField` 指定值字段
- `VChart.registerMap(mapName, mapData)` 为 VChart 提供的地图数据注册的 api，默认为 geojson 类型地图数据，也支持 topojson 数据注册；
- `map: china` 指定使用注册的地图数据名称；
- `nameMap` 为地图数据中的地理名称与数据中的名称映射关系，用于地图数据与数据中的名称不一致时使用；

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/geojson/usa.json');
const geojson = await response.json();
VChart.registerMap('usa', geojson);

const spec = {
  type: 'map',
  title: {
    text: 'USA Population Estimates (2012)',
    subtext: 'Data from www.census.gov'
  },
  color: {
    type: 'linear',
    range: ['rgb(252,250,97)', 'rgb(252,150,134)', 'rgb(87,33,15)']
  },
  area: {
    style: {
      fill: {
        field: 'value',
        scale: 'color',
        changeDomain: 'replace'
      }
    }
  },
  data: [
    {
      values: [
        { name: 'Alabama', value: 4822023 },
        { name: 'Alaska', value: 731449 },
        { name: 'Arizona', value: 6553255 },
        { name: 'Arkansas', value: 2949131 },
        { name: 'California', value: 38041430 },
        { name: 'Colorado', value: 5187582 },
        { name: 'Connecticut', value: 3590347 },
        { name: 'Delaware', value: 917092 },
        { name: 'District of Columbia', value: 632323 },
        { name: 'Florida', value: 19317568 },
        { name: 'Georgia', value: 9919945 },
        { name: 'Hawaii', value: 1392313 },
        { name: 'Idaho', value: 1595728 },
        { name: 'Illinois', value: 12875255 },
        { name: 'Indiana', value: 6537334 },
        { name: 'Iowa', value: 3074186 },
        { name: 'Kansas', value: 2885905 },
        { name: 'Kentucky', value: 4380415 },
        { name: 'Louisiana', value: 4601893 },
        { name: 'Maine', value: 1329192 },
        { name: 'Maryland', value: 5884563 },
        { name: 'Massachusetts', value: 6646144 },
        { name: 'Michigan', value: 9883360 },
        { name: 'Minnesota', value: 5379139 },
        { name: 'Mississippi', value: 2984926 },
        { name: 'Missouri', value: 6021988 },
        { name: 'Montana', value: 1005141 },
        { name: 'Nebraska', value: 1855525 },
        { name: 'Nevada', value: 2758931 },
        { name: 'New Hampshire', value: 1320718 },
        { name: 'New Jersey', value: 8864590 },
        { name: 'New Mexico', value: 2085538 },
        { name: 'New York', value: 19570261 },
        { name: 'North Carolina', value: 9752073 },
        { name: 'North Dakota', value: 699628 },
        { name: 'Ohio', value: 11544225 },
        { name: 'Oklahoma', value: 3814820 },
        { name: 'Oregon', value: 3899353 },
        { name: 'Pennsylvania', value: 12763536 },
        { name: 'Rhode Island', value: 1050292 },
        { name: 'South Carolina', value: 4723723 },
        { name: 'South Dakota', value: 833354 },
        { name: 'Tennessee', value: 6456243 },
        { name: 'Texas', value: 26059203 },
        { name: 'Utah', value: 2855287 },
        { name: 'Vermont', value: 626011 },
        { name: 'Virginia', value: 8185867 },
        { name: 'Washington', value: 6897012 },
        { name: 'West Virginia', value: 1855413 },
        { name: 'Wisconsin', value: 5726398 },
        { name: 'Wyoming', value: 576412 }
      ]
    }
  ],
  nameField: 'name',
  valueField: 'value',
  nameProperty: 'name',
  map: 'usa',
  region: [
    {
      roam: true,
      projection: {
        type: 'albersUsa'
      }
    }
  ],
  legends: [
    {
      visible: true,
      type: 'color',
      field: 'value',
      orient: 'bottom',
      position: 'start',
      title: {
        visible: true,
        text: 'Population'
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[地图](link)
