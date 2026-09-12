# Brush Selection

Brush is an interactive component provided by VChart, which can help users select data in the chart, making it convenient for users to further analyze or manipulate data. This tutorial mainly introduces the related concepts and components of Brush. For more detailed configuration and examples of Brush, please refer to the [configuration documentation](../../../option) and [example](../../../example) pages.

## Components

The Brush component mainly consists of a selection area, providing rich selection types, styles, and interactions, and also provides corresponding event support (`brushChange`, see [Event API](/vchart/api/API/event) for details).

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a21b.png" alt="Brush Schematic">
</div>

### Selection Types

Brush provides 4 common types of selection, and users can choose the appropriate type according to the actual needs:

- 'x': Horizontal selection, only select data in the X-axis direction
- 'y': Vertical selection, only select data in the Y-axis direction
- 'rect': Rectangular selection box, users can draw a rectangular box in the chart to select the data inside
- 'polygon': Arbitrary shape selection box, users can freely draw a polygonal box in the chart to select the data inside

### Styles and Interactions

Brush supports setting styles inside and outside the selection box, such as color, transparency, etc. At the same time, it can also achieve some interactive effects, such as highlighting selected data.

## Example

Next, we will demonstrate how to use the Brush selection component in VChart through a specific example.

First, we need to prepare a scatter chart and use the following code to define the spec of the scatter chart:

```javascript
const spec = {
  type: 'scatter',
  data: [
    {
      values: [
        { x: 936196, size: 83431, y: 1371, type: 'Technology', area: 'Northeast' },
        { x: 1270911, size: 219815, y: 5590, type: 'Office Supplies', area: 'Central-South' }
        // ... more data items
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  sizeField: 'size',
  size: [10, 25],
  shapeField: 'type',
  shape: ['circle', 'triangle'],
  direction: 'horizontal',
  axes: [
    { orient: 'left', range: { min: 0 }, type: 'linear' },
    { orient: 'bottom', label: { visible: true }, type: 'linear' }
  ]
};
```

Now, we want to add a selection function to this scatter chart, simply add a brush configuration item to the spec and set the appropriate parameters:

```javascript
spec.brush = {
  brushType: 'polygon', // Set the selection type to arbitrary shape selection box
  inBrush: {
    colorAlpha: 1 // Transparency of the data color in the selection box
  },
  outOfBrush: {
    colorAlpha: 0.2 // Transparency of the data color outside the selection box
  }
};
```

```javascript livedemo
const spec = {
  type: 'scatter',
  data: [
    {
      values: [
        { x: 936196, size: 83431, y: 1371, type: 'Technology', area: 'Northeast' },
        { x: 1270911, size: 219815, y: 5590, type: 'office supplies', area: 'Zhongnan' },
        { x: 453898, size: 19061, y: 727, type: 'Technology', area: 'Southwest' },
        { x: 919743, size: 148800, y: 1199, type: 'furniture', area: 'North China' },
        { x: 1676224, size: 163453, y: 2517, type: 'furniture', area: 'East China' },
        { x: 1466575, size: 251487, y: 2087, type: 'Technology', area: 'Zhongnan' },
        { x: 824673, size: 86067, y: 3622, type: 'office supplies', area: 'Northeast' },
        { x: 230956, size: 24016, y: 347, type: 'Technology', area: 'Northwest' },
        { x: 1599653, size: 228179, y: 2183, type: 'Technology', area: 'East China' },
        { x: 745813, size: 137265, y: 3020, type: 'office supplies', area: 'North China' },
        { x: 267870, size: 49633, y: 970, type: 'office supplies', area: 'Northwest' },
        { x: 1408628, size: 215585, y: 6341, type: 'office supplies', area: 'East China' },
        { x: 781743, size: 144986, y: 927, type: 'Technology', area: 'North China' },
        { x: 501533, size: 29303, y: 814, type: 'furniture', area: 'Southwest' },
        { x: 920698, size: 72692, y: 1470, type: 'furniture', area: 'Northeast' },
        { x: 316212, size: 24903, y: 468, type: 'furniture', area: 'Northwest' },
        { x: 1399928, size: 199582, y: 2023, type: 'furniture', area: 'Zhongnan' },
        { x: 347692, size: 49272, y: 1858, type: 'office supplies', area: 'Southwest' }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  sizeField: 'size',
  size: [10, 25],
  shapeField: 'type',
  shape: ['circle', 'triangle'],
  axes: [
    { orient: 'left', range: { min: 0 }, type: 'linear' },
    { orient: 'bottom', label: { visible: true }, type: 'linear' }
  ],
  legends: [
    {
      visible: true,
      orient: 'left',
      position: 'start',
      title: {
        visible: true,
        style: {
          text: 'title'
        }
      },
      item: {
        visible: true
      }
    }
  ],
  brush: {
    brushType: 'polygon',
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
```
