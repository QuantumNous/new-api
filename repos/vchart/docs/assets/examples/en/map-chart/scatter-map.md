---
category: examples
group: map chart
title: Scatter Map
keywords: map,space,polygon,scatter,distribution,comparison
order: 11-1
cover: /vchart/preview/scatter-map_1.9.1.png
option: mapChart
---

# Scatter Map

## Key option

- Specify the chart type `type: common` as a combination chart
- `series` field configures 2 chart series, this example configures a map series and a scatter series
  - `series[0]` is the map series
  - `series[1]` is the scatter series, which has a breathing point loop animation for data points with values greater than 6
    - `animationNormal` is the normal animation of the series, which is executed after the chart entrance animation, and is usually used for loop animation configuration;
- `region` configures a geographical coordinate system region for rendering maps. Meanwhile, the scatter series is associated with the current region by default, and the point position is calculated through geographic mapping.

  - `region[0].roam: true` configures the current region to support map zooming and dragging
  - `region[0].longitudeField` declares the longitude data field
  - `region[0].latitudeField` declares the latitude data field

- The continuous legend slider value defaults to a precision of 0, and for the current scenario where the data range is small, the display precision of the value is configured with `handlerText.precision`

## Demo source

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
    text: 'Global Earthquake Magnitude Visualization'
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

## Key option

None

## Related Tutorials

[Map](link)
