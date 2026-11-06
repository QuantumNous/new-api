---
category: examples
group: marker
title: markPoint
keywords: marker,mapChart
order: 33-5
cover: /vchart/preview/geo-mark-point-1.11.0.png
option: mapChart#markPoint
---

# markPoint in geo coordinates

## Key Configuration

- Use the `markPoint.areaName` attribute to declare the geographical location to be marked

## Demo source

```javascript livedemo
const response1 = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/map-mark-point.json');
const dataJson = await response1.json();
const data = dataJson.features.map(d => d['properties']);
const minValue = Math.min(...data.map(d => d.scores));
const maxValue = Math.max(...data.map(d => d.scores));

const response2 = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/geojson/usa.json');
const geojson = await response2.json();
VChart.registerMap('usa', geojson);

function sizeScale(value, domain, range) {
  const t = (value - domain[0]) / (domain[1] - domain[0]);
  const newValue = (range[1] - range[0]) * t + range[0];
  return newValue;
}

const spec = {
  type: 'map',
  title: {
    text: 'Opioid Overdose Rates (per 100,000) by Year: 2017'
  },
  color: {
    type: 'linear',
    range: ['rgb(252,250,97)', 'rgb(252,150,134)', 'rgb(87,33,15)']
  },
  area: {
    style: {
      fill: {
        field: 'scores',
        scale: 'color',
        changeDomain: 'replace'
      }
    }
  },
  data: [
    {
      values: data
    }
  ],
  nameField: 'name',
  valueField: 'scores',
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
      field: 'scores',
      orient: 'bottom',
      position: 'start',
      title: {
        visible: true,
        text: 'Population'
      }
    }
  ],
  markPoint: data.map(d => {
    return {
      areaName: d.name,
      itemLine: {
        visible: false
      },
      itemContent: {
        type: 'symbol',
        autoRotate: false,
        offsetX: -10,
        offsetY: -5,
        style: {
          size: sizeScale(d.scores, [minValue, maxValue], [20, 40]),
          fill: '#FF6347',
          symbolType:
            '<svg t="1713712806835" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="9361" width="200" height="200"><path d="M524.66 101.57H498c-116.06 0-210.15 94.09-210.15 210.15v383.44c0 123.23 100.25 223.48 223.48 223.48s223.48-100.25 223.48-223.48V311.72c0.01-116.06-94.08-210.15-210.15-210.15z m-40.72 28.86c8.09 0 14.65 6.56 14.65 14.65s-6.56 14.65-14.65 14.65-14.66-6.56-14.66-14.65 6.57-14.65 14.66-14.65zM325.23 279C352.8 156.23 437.3 142.24 440.88 141.7c7.25-1.07 14.07 3.92 15.16 11.22 1.08 7.26-3.9 14.02-11.14 15.15-3.09 0.51-70.32 12.86-93.65 116.78-1.39 6.2-6.89 10.41-12.99 10.41-0.97 0-1.95-0.1-2.94-0.33-7.19-1.61-11.71-8.74-10.09-15.93z m382.93 416.16c0 108.53-88.3 196.82-196.82 196.82s-196.82-88.3-196.82-196.82V514.82h393.64v180.34z" p-id="9362"></path></svg>'
        }
      }
    };
  })
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related tutorials

[scrollBar](link)
