---
category: examples
group: map chart
title: 散点地图
keywords: map,space,polygon,scatter,distribution,comparison
order: 11-1
cover: /vchart/preview/scatter-map_1.9.1.png
option: mapChart
---

# 散点地图

## 关键配置

- 指定图表表类型`type: common`为组合图
- `series` 字段配置 2 个图表系列，本例中配置了一个地图系列和一个散点系列
  - `series[0]`为地图系列
  - `series[1]`为散点系列，散点系列为数据中值大于 6 的点配置了一个呼吸点循环动画
    - `animationNormal` 为系列的常规动画，在图表入场动画结束后执行，通常用于循环动画配置；
- `region` 配置了一个坐标系为地理坐标系的区域，用于绘制地图。同时散点系列默认关联当前 region，也会通过地理映射计算点的位置。

  - `region[0].roam: true` 配置当前区域支持地图缩放和拖拽
  - `region[0].longitudeField` 声明经度数据字段
  - `region[0].latitudeField` 声明纬度数据字段

- 连续图例的滑块数值默认精度为 0，针对当前场景，数据范围较小，所以通过 `handlerText.precision` 配置数值的显示精度

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/geojson/world.json');
const geojson = await response.json();
VChart.registerMap('world', geojson);

const dataResponse = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/geojson/earthquake.json');
const earthquakeData = await dataResponse.json();

const spec = {
  type: 'common',
  region: [
    {
      roam: true,
      coordinate: 'geo',
      longitudeField: 'lng',
      latitudeField: 'lat',
      projection: {
        type: 'equirectangular'
      }
    }
  ],
  title: {
    text: '全球地震数据等级可视化'
  },
  background: 'rgb(240, 248, 255)',
  data: [{ values: earthquakeData.values }],
  series: [
    { type: 'map', map: 'world', tooltip: { visible: false }, defaultFillColor: 'rgb(245,255,250)' },
    {
      type: 'scatter',
      xField: 'time',
      yField: 'level',
      point: {
        style: {
          size: datum => {
            return datum.level > 7 ? +datum.level * 2 : +datum.level;
          },
          fill: 'red',
          fillOpacity: 0.2
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 关键配置

无

## 相关教程

[地图](link)
