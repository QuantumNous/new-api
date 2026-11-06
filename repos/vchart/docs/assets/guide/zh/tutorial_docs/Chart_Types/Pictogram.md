# 象形图

[\[配置项\]](../../../option/pictogramChart)

## 简介

象形图（Pictogram Charts）是一种使用图形、符号和图像来表示数据的图表形式。与传统的条形图、折线图等数值图表不同，象形图式图表通过图像化的方式呈现数据，更容易理解和记忆。这种图表可以强调数据的视觉效果，使观众更快速地抓住数据的关键信息。

### 图表构成

象形图的配置方式与地图有一些类似，主要由以下组件构成：

- svg 素材
- 数据

象形图的数据字段及数据映射有如下配置：

- `pictogramChart.type`: 图表类型，象形图的类型为`'pictogram'`
- `pictogramChart.data`: 图表绘制的数据源
- `pictogramChart.nameField` 属性声明为名称的字段，用于与 SVG 中的图形元素进行关联

- 更多组件配置见[VChart pictogramChart 配置](../../../option/pictogramChart)

### 快速上手

可以使用 SVG 字符作为素材，目前 VChart 支持的 SVG 图元包括：

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

包括 defs/style/switch/C/Q/pattern/use 等用法暂不支持。

这里有一个简单的例子，这个例子中，图表没有任何数据，所以没有任何数据映射，只是一个对 SVG 素材的展示。

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入 registerPictogramChart 并执行
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerPictogramChart();
/** --在业务中使用时请删除以上代码-- */
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

或者可以通过请求获取 SVG 资源：

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入 registerPictogramChart 并执行
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerPictogramChart();
/** --在业务中使用时请删除以上代码-- */

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

### 关键配置

- `nameField` 属性声明为名称字段配置，用于使得 SVG 中的图形元素与数据中相同 `nameField` 值的数据项进行关联
- `valueField` 属性声明为值字段配置
- `pictogram` 所有关联了 name 的图元的样式配置。（其他图元的样式与 SVG 定义一致，无法配置）

对于有指定名称（name 属性） 的元素，可以通过名称配置其指定样式，例如下面这个例子，可以对命名为 'Yes' 的图元进行常规和交互的样式设置：

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入 registerPictogramChart 并执行
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerPictogramChart();
/** --在业务中使用时请删除以上代码-- */

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

对于拥有相同名称的图元，在样式设置、交互时会同时生效，例如：

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外引入 registerPictogramChart 并执行
// import { registerPictogramChart } from '@visactor/vchart';
// registerPictogramChart();
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
VCHART_MODULE.registerPictogramChart();
/** --在业务中使用时请删除以上代码-- */

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

更多示例请查看[象形图示例](/vchart/demo/pictogram-chart/pictogram-cow)。

### 更多说明

象形图没有在 VChart 默认引入，如需使用，请手动引入象形图。

```ts
import { registerPictogramChart } from '@visactor/vchart';
registerPictogramChart();
```
