---
category: examples
group: bar chart
title: 基础条形图
keywords: barChart,comparison,distribution,rank,rectangle
order: 2-7
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/bar-chart/bar-regression-line.png
option: barChart
---

# Simple Bar Chart + Regression Line

## Key Configuration

By passing different configuration items to the `appendBarRegressionLineConfig` method, you can add multiple regression lines of different degrees and styles to the bar chart.

- `degree`: The degree of the polynomial regression, e.g., 2 for quadratic, 3 for cubic.
- `color`: The color of the regression line.
- `line.style`: Style configuration for the regression line, such as `lineWidth` for line thickness.
- `confidenceInterval.visible`: Whether to display the confidence interval (boolean).
- `confidenceInterval.style`: Style configuration for the confidence interval, such as `fillOpacity` for opacity.
- `label.text`: The label text for the regression line.

## Code Example

```javascript livedemo
/** --Add the following code when using in your project-- */
// When using in your project, please additionally install @visactor/vchart-extension, and keep the package version consistent with vchart
// import { appendBarRegressionLineConfig, registerRegressionLine } from '@visactor/vchart-extension';
/** --Add the above code when using in your project-- */

/** --Remove the following code when using in your project-- */
const { appendBarRegressionLineConfig, registerRegressionLine } = VChartExtension;
/** --Remove the above code when using in your project-- */

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          name: 'Apple',
          value: 214480
        },
        {
          name: 'Google',
          value: 155506
        },
        {
          name: 'Amazon',
          value: 100764
        },
        {
          name: 'Microsoft',
          value: 92715
        },
        {
          name: 'Coca-Cola',
          value: 66341
        },
        {
          name: 'Samsung',
          value: 59890
        },
        {
          name: 'Toyota',
          value: 53404
        },
        {
          name: 'Mercedes-Benz',
          value: 48601
        },
        {
          name: 'Facebook',
          value: 45168
        },
        {
          name: "McDonald's",
          value: 43417
        },
        {
          name: 'Intel',
          value: 43293
        },
        {
          name: 'IBM',
          value: 42972
        },
        {
          name: 'BMW',
          value: 41006
        },
        {
          name: 'Disney',
          value: 39874
        },
        {
          name: 'Cisco',
          value: 34575
        },
        {
          name: 'GE',
          value: 32757
        },
        {
          name: 'Nike',
          value: 30120
        },
        {
          name: 'Louis Vuitton',
          value: 28152
        },
        {
          name: 'Oracle',
          value: 26133
        },
        {
          name: 'Honda',
          value: 23682
        }
      ]
    }
  ],
  xField: 'name',
  yField: 'value'
};

registerRegressionLine();
appendBarRegressionLineConfig(spec, [
  {
    degree: 2,
    color: 'red',
    line: {
      style: {
        lineWidth: 2
      }
    },
    confidenceInterval: {
      visible: false
    },
    label: {
      text: '2 次多项式拟合'
    }
  },
  {
    degree: 3,
    color: 'green',
    line: {
      style: {
        lineWidth: 2
      }
    },
    confidenceInterval: {
      style: {
        fillOpacity: 0.2
      }
    },
    label: {
      text: '3 次多项式拟合'
    }
  }
]);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

```

```
