---
category: demo
group: data-zoom
title: datazoom supports zoomLock
keywords: barChart,dataZoom
order: 29-4
cover: /vchart/preview/data-zoom-lock_1.5.0.png
option: barChart#dataZoom
---

# Datazoom Supports ZoomLock

In the dataZoom component, you can configure whether to lock the size of the currently selected area. Once configured, it means that the size of the range interval will no longer change.

## Key option

- The `zoomLock` attribute is declared to determine whether to lock the size of the selection area (or data window)

## Demo source

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/cars.json');
const data = await response.json();
const spec = {
  type: 'scatter',
  xField: 'Miles_per_Gallon',
  yField: 'Horsepower',
  seriesField: 'Origin',
  data: [
    {
      id: 'data',
      values: data.filter(d => d['Horsepower'] && d['Miles_per_Gallon'])
    }
  ],
  dataZoom: [
    {
      orient: 'bottom',
      start: 0,
      end: 0.4,
      zoomLock: true,
      filterMode: 'axis'
    }
  ],
  axes: [
    {
      title: {
        visible: true,
        text: 'Horse Power'
      },
      orient: 'left',
      type: 'linear'
    },
    {
      title: {
        visible: true,
        text: 'Miles Per Gallon'
      },
      orient: 'bottom',
      label: { visible: true },
      type: 'linear'
    }
  ],
  legends: [{}]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attached are links to tutorials or API documentation related to this demo configuration.
