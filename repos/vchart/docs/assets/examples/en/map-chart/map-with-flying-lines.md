---
category: examples
group: map chart
title: Map With Flying Lines
keywords: map,space,polygon,scatter,line
order: 11-2
cover: /vchart/preview/map-with-flying-lines_1.11.1.png
option: mapChart
---

# Map With Flying Lines

## Key option

- Specify the chart table type `type: common` as a combined chart.
- The `series` field is used to configure the chart series, in this case a map series, a scatter series, and a line series are configured
  - `series[0]` for the map series
  - `series[1]` is the scatter series
  - `series[2]` is the line series, used for the flying lines
    - `seriesField: 'type'` is used to set the series, otherwise the data points will be connected sequentially

## Demo source

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
      addr: 'Hutubi, Changji, Xinjiang'
    },
    {
      lng: 118.68,
      lat: 40.21,
      time: '2018-12-06 21:07:56',
      level: '2.1',
      depth: '13',
      addr: "Qian'an, Tangshan, Hebei"
    },
    {
      lng: 99.61,
      lat: 23.92,
      time: '2018-12-06 06:23:34',
      level: '2.9',
      depth: '5',
      addr: 'Gengma, Lincang, Yunnan'
    },
    {
      lng: 118.62,
      lat: 23.36,
      time: '2018-12-05 20:22:51',
      level: '3.7',
      depth: '15',
      addr: 'Taiwan'
    },
    {
      lng: 77.45,
      lat: 40.4,
      time: '2018-12-05 13:52:37',
      level: '4.1',
      depth: '17',
      addr: 'Qizilsu or Atushi, Xinjiang'
    }
  ]
};
const center = {
  lng: 119.2,
  lat: 28.5,
  addr: 'Jinhua, Zhejiang'
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

## Related Tutorials

[Map](link)
