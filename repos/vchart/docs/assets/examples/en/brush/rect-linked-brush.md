---
category: demo
group: brush
title: Rect Linked Brush
keywords: scatterChart,brush
order: 32-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/brush/rect-linked-brush.png
option: commonChart#brush
---

# Rect Linked Brush

The selection box component allows users to select arbitrary chart elements in a multi-selection manner within the chart area.

## Key option

- The `brushType` attribute is declared as a selection box type, and the optional values are:

  - `'x'`: Horizontal selection
  - `'y'`: Vertical selection
  - `'rect'`: Rectangular selection box
  - `'polygon'`: Arbitrary shape selection box

- The `brushLinkSeriesIndex` attribute declares the series index for the linked selection box. After configuration, the linked series will be highlighted along with the main series.

- The `inBrush` attribute declares the style of the selected chart elements. In addition to basic element style attributes, the following properties are provided:
  - `symbol`: The shape category of the element (only valid when the type of the selected element is `'symbol'`).
  - `symbolSize`: The size of the element (only valid when the type of the selected element is `'symbol'`).
  - `color`: The color of the element.
  - `colorAlpha`: The transparency of the element, ranging from `[0, 1]`.
- The `outOfBrush` attribute declares the style of unselected chart elements. Configurable styles are the same as above.

## Live Demo

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/brush-data.json');
const dataBrush = await response.json();

const row = 4;
const col = 4;
const region = [];
const layoutElements = [];
const series = [];
const axes = [];
const rowHeight = [];
for (let k = 0; k < row * col; k++) {
  region.push({
    id: `${k}_Region`
  });

  const seriesRow = Math.floor(k / col) + Math.floor(k / col);
  const seriesCol = k - Math.floor(k / col) * col;

  // 系列行
  layoutElements.push({
    row: seriesRow,
    col: seriesCol + seriesCol + 1,
    modelId: `${k}_Region`
  });

  series.push({
    id: `${k}_Region`,
    type: 'scatter',
    xField: 'x',
    yField: 'y',
    seriesField: 'type',
    data: { id: `${k}_Data`, values: dataBrush[k] },
    regionId: `${k}_Region`,
    size: 5
  });

  axes.push({
    id: `${k}_Left`,
    orient: 'left',
    regionId: `${k}_Region`,
    seriesId: [`${k}_Region`],
    zero: false
  });

  layoutElements.push({
    row: seriesRow,
    col: seriesCol + seriesCol,
    modelId: `${k}_Left`
  });

  axes.push({
    id: `${k}_Bottom`,
    orient: 'bottom',
    regionId: `${k}_Region`,
    seriesId: [`${k}_Region`],
    type: 'linear',
    zero: false
  });

  layoutElements.push({
    row: seriesRow + 1,
    col: seriesCol + seriesCol + 1,
    modelId: `${k}_Bottom`
  });

  if (seriesCol === 0) {
    rowHeight.push({
      index: seriesRow + 1,
      size: 30
    });
  }
}

const spec = {
  type: 'common',
  padding: 30,
  region,
  layout: {
    type: 'grid',
    col: col * 2,
    row: row * 2,
    elements: layoutElements,
    rowHeight
  },
  axes,
  tooltip: false,
  series,
  brush: {
    seriesIndex: Array.from({ length: 16 }, (v, k) => k),
    brushType: 'rect',
    brushLinkSeriesIndex: Array.from({ length: 16 }, (v, k) => k),
    inBrush: {
      colorAlpha: 1
    },
    outOfBrush: {
      colorAlpha: 0.2
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID, animation: false });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

Attach links to tutorials or API documentation related to the demo configuration.
