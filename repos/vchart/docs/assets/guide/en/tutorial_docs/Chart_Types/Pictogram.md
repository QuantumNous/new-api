# Pictogram

[\[Option Items\]](../../../option/pictogramChart)

## Introduction

Pictogram Charts are a form of chart that uses graphics, symbols, and images to represent data. Different from traditional numerical charts such as bar charts and line charts, pictogram-style charts present data in an image-based way, which is easier to understand and remember. This type of chart can emphasize the visual effect of data, allowing viewers to grasp the key information of the data more quickly.

### Chart Composition

The configuration of pictograms is somewhat similar to that of maps and mainly consists of the following components:

- svg materials
- data
  The data fields and data mappings of pictograms have the following configurations:
- `pictogramChart.type`: The chart type. The type of pictogram is `'pictogram'`.
- `pictogramChart.data`: The data source for chart drawing.
- `pictogramChart.nameField`: The field declared as the name property, used to associate with graphic elements in the SVG.
  A set of data is defined as follows:
- For more component configurations, see [VChart pictogramChart Configuration](../../../option/pictogramChart).

### Quick Start

SVG characters can be used as materials, and the SVG primitives currently supported by VChart include:

- rect
- line
- path
- polygon
- circle
- ellipse
- polyline
- text
- tspan
- g

Including defs/style/switch/C/Q/pattern/use, etc. are not supported for the time being.

Here is a simple example, in this example, the chart has no data, so there is no data mapping, just a display of SVG materials.

```javascript livedemo
/** -- Please add the following code when using it in business -- */
// When using it in business, please additionally import registerPictogramChart and execute it.
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
/** -- Please add the above code when using it in business -- */
/** -- Please delete the following code when using it in business -- */
VCHART_MODULE.registerPictogramChart();
/** -- Please delete the above code when using it in business -- */
const shape = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
<!-- Rectangle -->
<rect name="rect" x="10" y="10" width="100" height="50" fill="blue"/>

<!-- Circle -->
<circle name="circle" cx="200" cy="50" r="40" fill="red"/>

<!-- Ellipse -->
<ellipse name="ellipse" cx="100" cy="150" rx="60" ry="30" fill="green"/>

<!-- Line -->
<line name="line" x1="10" y1="200" x2="200" y2="200" stroke="black" stroke-width="2"/>

<!-- Polyline -->
<polyline name="polyline" points="220,210 240,230 260,210 280,230" fill="none" stroke="purple" stroke-width="2"/>

<!-- Polygon -->
<polygon name="polygon" points="300,10 350,10 375,50 325,90 275,50" fill="orange"/>

<!-- Path -->
<path name="path" d="M 20 300 Q 100 350 180 300 T 340 300" fill="none" stroke="brown" stroke-width="2"/>

<!-- Text -->
<text name="text" x="20" y="350" font-family="Verdana" font-size="20" fill="black">Hello, SVG!</text>
</svg>`;
const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    values: []
  },
  region: [
    {
      roam: { blank: true }
    }
  ],
  seriesField: 'name',
  nameField: 'name',
  valueField: 'value',
  svg: 'shapes'
};
VChart.registerSVG('shapes', shape);
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

Or you can obtain SVG resources through requests:

```javascript livedemo
/** -- Please add the following code when using it in business -- */
// When using it in business, please additionally import registerPictogramChart and execute it.
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
/** -- Please add the above code when using it in business -- */
/** -- Please delete the following code when using it in business -- */
VCHART_MODULE.registerPictogramChart();
/** -- Please delete the above code when using it in business -- */

const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/pictogram/cat.svg');
const shape = await response.text();

const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    values: []
  },
  seriesField: 'name',
  nameField: 'name',
  valueField: 'value',
  svg: 'cat'
};

VChart.registerSVG('cat', shape);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### Key Configurations

- `nameField`: This attribute is declared as a name field configuration, used to associate the graphic elements in SVG with the data items in the data that have the same `nameField` value.
- `valueField`: The configuration of the field declared as the value.
- `pictogram`: The style configuration of all graphic elements associated with the name. (The styles of other graphic elements are the same as those defined in the SVG and cannot be configured.)
  For elements with a specified name, their specified styles can be configured through the name. For example, in the following example, the regular and interactive styles of the rect graphic element can be set:

```javascript livedemo
/** -- Please add the following code when using it in business -- */
// When using it in business, please additionally import registerPictogramChart and execute it.
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
/** -- Please add the above code when using it in business -- */
/** -- Please delete the following code when using it in business -- */
VCHART_MODULE.registerPictogramChart();
/** -- Please delete the above code when using it in business -- */
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/pictogram/cat.svg');
const shape = await response.text();

const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    values: [{ name: 'Yes', value: 'Love This' }, { name: 'So-so' }, { name: 'Forbidden' }, { name: 'Horror' }]
  },
  seriesField: 'name',
  nameField: 'name',
  valueField: 'value',
  svg: 'cat',
  color: {
    specified: {
      Yes: '#009A00',
      'So-so': '#FEB202',
      Forbidden: '#FE3E00',
      Horror: '#FE2B09',
      undefined: 'white'
    }
  },
  pictogram: {
    style: {
      fill: {
        scale: 'color',
        field: 'name'
      }
    }
  },
  Yes: {
    style: {
      stroke: 'black',
      lineWidth: 2
    },
    state: {
      hover: {
        fill: 'green'
      }
    }
  },
  title: { text: 'Cat Stroking For Beginners' },
  legends: { orient: 'top', filter: false }
};

VChart.registerSVG('cat', shape);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

For graphic elements with the same name, the style settings and interactions will take effect simultaneously. For example:

```javascript livedemo
/** -- Please add the following code when using it in business -- */
// When using it in business, please additionally import registerPictogramChart and execute it.
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
/** -- Please add the above code when using it in business -- */
/** -- Please delete the following code when using it in business -- */
VCHART_MODULE.registerPictogramChart();
/** -- Please delete the above code when using it in business -- */
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/pictogram/cat.svg');
const shape = await response.text();

const spec = {
  type: 'pictogram',
  data: {
    id: 'data',
    values: [{ name: 'Yes' }, { name: 'So-so' }, { name: 'Forbidden' }, { name: 'Horror' }]
  },
  region: [
    {
      roam: { blank: true }
    }
  ],
  seriesField: 'name',
  nameField: 'name',
  valueField: 'value',
  svg: 'cat',
  color: {
    specified: {
      Yes: '#009A00',
      'So-so': '#FEB202',
      Forbidden: '#FE3E00',
      Horror: '#FE2B09',
      undefined: 'white'
    }
  },
  interactions: [
    {
      // 图例的高亮交互
      type: 'element-active-by-legend',
      // 根据数据中 name 字段对图元进行过滤
      filterField: 'name'
    }
  ],
  pictogram: {
    style: {
      fill: {
        scale: 'color',
        field: 'name'
      }
    },
    state: {
      // 通过图例交互时的样式
      active: {
        fillOpacity: 0.8,
        stroke: {
          scale: 'color',
          field: 'name'
        },
        lineWidth: 2
      },
      // 鼠标悬浮在图元时的样式
      hover: {
        fillOpacity: 0.8,
        stroke: {
          scale: 'color',
          field: 'name'
        },
        lineWidth: 2
      }
    }
  },
  title: { text: 'Cat Stroking For Beginners' },
  legends: { orient: 'top', filter: false }
};

VChart.registerSVG('cat', shape);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

For more examples, please see [Pictogram Example](/vchart/demo/pictogram-chart/pictogram-cow).

### More Explanations

Pictograms are not included in the VChart by default. If you need to use them, please manually import pictograms.

```ts
import { registerPictogramChart } from '@visactor/vchart';
registerPictogramChart();
```
