# Quick Start

In this tutorial, we will introduce how to use VChart to draw a simple bar chart. VChart is a simple-to-use, cross-platform, high-performance frontend visualization chart library. Charts are composed of data, series, and components. We will use the configuration options to declare the chart.

## Getting VChart

You can obtain VChart in the following ways.

### Using NPM package

First, you need to install VChart in the project root directory using the following command:

```sh
# Install using npm
npm install @visactor/vchart

# Install using yarn
yarn add @visactor/vchart
```

### Using CDN

You can also obtain the pre-built VChart file via CDN. Add the following code to the `<script>` tag in the HTML file:

```html
<script src="https://unpkg.com/@visactor/vchart/build/index.min.js"></script>
```

## Importing VChart

### Importing via NPM package

Use `import` at the top of the JavaScript file to import VChart:

```js
import VChart from '@visactor/vchart';
```

### Importing using script tag

Import the pre-built vchart file by directly adding a `<script>` tag in the HTML file:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <!-- Import vchart file -->
    <script src="https://unpkg.com/@visactor/vchart/build/index.min.js"></script>
  </head>
</html>
```

## Drawing a simple chart

Before drawing, we need to prepare a DOM container with a width and height for VChart.

```html
<body>
  <!-- Prepare a DOM with size (width and height) for vchart, or you can specify it in the spec configuration -->
  <div id="chart" style="width: 600px;height:400px;"></div>
</body>
```

Next, we create a `VChart` instance, passing in the chart configuration options and the ID of the DOM container:

```ts
const spec = {
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  type: 'bar',
  xField: 'month',
  yField: 'sales'
};

// Create a vchart instance
/**
 * Note: When using the CDN approach for importing, pay attention to the way VChart is referenced:
 * const vchart = new VChart.default(spec, { dom: 'chart' });
 */
const vchart = new VChart(spec, { dom: 'chart' });
// Draw the chart
vchart.renderSync();
```

At this point, you have successfully drawn a simple bar chart!

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales'
};
/**
 * Note: When using the CDN approach for importing, pay attention to the way VChart is referenced:
 * const vchart = new VChart.default(spec, { dom: 'chart' });
 */
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

I hope this tutorial has helped you learn how to use VChart. Now, you can try drawing different types of charts and customize more diverse chart effects by delving into the various configuration options available in VChart. Embark on your VChart journey with confidence!
