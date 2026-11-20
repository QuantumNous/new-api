---
category: examples
group: map chart
title: 带飞线的地图
keywords: map,space,polygon,scatter,line
order: 11-2
cover: /vchart/preview/map-with-flying-lines_1.11.1.png
option: mapChart
---

# 带飞线的地图

## 关键配置

- 指定图表表类型`type: common`为组合图
- `series` 字段用于配置图表系列，本例中配置了一个地图系列、一个散点系列和一个折线系列
  - `series[0]`为地图系列
  - `series[1]`为散点系列
  - `series[2]`为折线系列，用于实现飞线效果
    - `seriesField: 'type'`用于设置系列，否则各数据点会顺序相连

## 代码演示

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/geojson/world.json');
const geojson = await response.json();
VChart.registerMap('world', geojson);

const earthquakeData = {
  values: [
    {
      lng: 86.38,
      lat: 43.82,
      time: '2018-12-08 06:39:26',
      level: '4.5',
      depth: '10',
      addr: '新疆昌吉州呼图壁县'
    },
    {
      lng: 118.68,
      lat: 40.21,
      time: '2018-12-06 21:07:56',
      level: '2.1',
      depth: '13',
      addr: '河北唐山市迁安市'
    },
    {
      lng: 99.61,
      lat: 23.92,
      time: '2018-12-06 06:23:34',
      level: '2.9',
      depth: '5',
      addr: '云南临沧市耿马县'
    },
    {
      lng: 118.62,
      lat: 23.36,
      time: '2018-12-05 20:22:51',
      level: '3.7',
      depth: '15',
      addr: '台湾海峡'
    },
    {
      lng: 77.45,
      lat: 40.4,
      time: '2018-12-05 13:52:37',
      level: '4.1',
      depth: '17',
      addr: '新疆克孜勒苏州阿图什市'
    }
  ]
};
const center = {
  lng: 119.2,
  lat: 28.5,
  addr: '浙江省金华市'
};

const spec = {
  type: 'common',
  region: [
    {
      roam: false,
      coordinate: 'geo',
      longitudeField: 'lng',
      latitudeField: 'lat',
      projection: {
        type: 'equirectangular'
      }
    }
  ],
  background: 'rgb(240, 248, 255)',
  data: [{ values: earthquakeData.values }],
  series: [
    {
      type: 'map',
      map: 'world',
      tooltip: { visible: false },
      defaultFillColor: 'rgb(245,255,250)'
    },
    {
      type: 'scatter',
      xField: 'time',
      yField: 'addr',
      point: {
        style: {
          size: datum => Number(datum.depth),
          fill: 'green'
        }
      },
      label: {
        visible: true,
        position: 'right',
        style: {
          fill: '#333',
          fontWeight: 'bold'
        }
      }
    },
    {
      type: 'line',
      seriesField: 'type',
      line: { style: { stroke: 'green' } },
      point: { visible: false },
      data: {
        values: [
          ...earthquakeData.values.map((value, index) => ({
            ...value,
            type: index
          })),
          ...earthquakeData.values.map((_, index) => ({
            ...center,
            type: index
          }))
        ]
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
