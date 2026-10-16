# Regression Line Extension Guide

Regression lines are commonly used in statistical scenarios. The `vchart-extensions` package supports regression line extensions, including calculation and display of common regression lines (polynomial regression, kernel density estimation (KDE), empirical cumulative distribution function (ECDF), etc.).

## Registering the Extension

The regression line component is located in the extension package. You need to register the component before use:

```js
import VChart from '@visactor/vchart';
import {
  registerRegressionLine,
  appendBarRegressionLineConfig,
  appendHistogramRegressionLineConfig,
  appendScatterRegressionLineConfig
} from '@visactor/vchart-extension';

registerRegressionLine();
```

If you are using the CDN global variable `VChartExtension`, call `VChartExtension.registerRegressionLine()`.

## API Overview

- `registerRegressionLine()` — Registers the regression line component and enables additional configuration methods.
- `appendBarRegressionLineConfig(spec, config)` — Adds regression line configuration to bar chart specs. Note: currently only supports simple bar charts (no grouping, stacking, etc.), and only polynomial regression lines.
- `appendHistogramRegressionLineConfig(spec, config)` — Adds regression overlays to histograms (supports `kde` and `ecdf`).
- `appendScatterRegressionLineConfig(spec, config)` — Adds regression lines to scatter plots.

## Bar Chart Regression Line

### Example

Use `appendBarRegressionLineConfig` to add regression lines to a bar chart:

```javascript livedemo
/** --Add the following code in your business usage-- */
// When using in your project, make sure to install @visactor/vchart-extension with the same version as vchart
// import { appendBarRegressionLineConfig, registerRegressionLine } from '@visactor/vchart-extension';
/** --Add the above code in your business usage-- */

/** --Remove the following code in your business usage-- */
const { appendBarRegressionLineConfig, registerRegressionLine } = VChartExtension;
/** --Remove the above code in your business usage-- */

const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { name: 'Apple', value: 214480 },
        { name: 'Google', value: 155506 },
        { name: 'Amazon', value: 100764 },
        { name: 'Microsoft', value: 92715 },
        { name: 'Coca-Cola', value: 66341 },
        { name: 'Samsung', value: 59890 },
        { name: 'Toyota', value: 53404 },
        { name: 'Mercedes-Benz', value: 48601 },
        { name: 'Facebook', value: 45168 },
        { name: "McDonald's", value: 43417 },
        { name: 'Intel', value: 43293 },
        { name: 'IBM', value: 42972 },
        { name: 'BMW', value: 41006 },
        { name: 'Disney', value: 39874 },
        { name: 'Cisco', value: 34575 },
        { name: 'GE', value: 32757 },
        { name: 'Nike', value: 30120 },
        { name: 'Louis Vuitton', value: 28152 },
        { name: 'Oracle', value: 26133 },
        { name: 'Honda', value: 23682 }
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
      text: '2nd Degree Polynomial Fit'
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
      text: '3rd Degree Polynomial Fit'
    }
  }
]);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### Configuration Type Definition

The regression line configuration type is defined as follows:

```ts
{
  /**
   * Degree of the polynomial
   */
  degree?: number;
  /**
   * Color value
   */
  color?: string;
  /**
   * Regression line configuration
   */
  line?: {
    /**
     * Whether to show the series label
     * @default true
     */
    visible?: boolean;
    /**
     * Line style
     */
    style?: ILineGraphicAttribute;
  };
  /**
   * Regression line formula label
   */
  label?: {
    /**
     * Whether to show the label
     */
    visible?: boolean;
    /**
     * Label text
     */
    text: string;
    /**
     * Label style
     */
    style?: ITextGraphicAttribute;
  };
  /**
   * Confidence interval
   */
  confidenceInterval?: {
    visible?: boolean;
    style?: IAreaGraphicAttribute;
  };
}
```

## Histogram Example (KDE / ECDF)

### Example

Histogram regression supports overlaying KDE or ECDF curves on histograms. Make sure your data has been transformed with `bin`, and that `xField/x2Field/yField` are configured correctly.

```javascript livedemo
/** --Add the following code in your business usage-- */
// When using in your project, make sure to install @visactor/vchart-extension with the same version as vchart
// import { registerRegressionLine, appendHistogramRegressionLineConfig } from '@visactor/vchart-extension';
/** --Add the above code in your business usage-- */

/** --Remove the following code in your business usage-- */
const { registerRegressionLine, appendHistogramRegressionLineConfig } = VChartExtension;
/** --Remove the above code in your business usage-- */

function boxMullerRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = Math.random();
  }
  while (v === 0) {
    v = Math.random();
  }
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function generateGaussian(count, mean = 0, sd = 1) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(mean + boxMullerRandom() * sd);
  }
  return out;
}

function generateMixtureGaussianSamples() {
  const a = generateGaussian(160, 5, 4, 1); // cluster A
  // const b = generateGaussian(80, 2.3, 0.08, 2); // cluster B
  // const c = generateGaussian(140, 9.3, 0.35, 3); // cluster C
  const outliers = [5.0, 6.2, 3.5, 12.0, 0.5];
  const arr = [...a, ...outliers];
  return arr.map(v => ({ value: v }));
}

const spec = {
  data: [
    {
      name: 'data1',
      transforms: [
        {
          type: 'bin',
          options: {
            step: 2,
            field: 'value',
            outputNames: { x0: 'x0', x1: 'x1', count: 'frequency' }
          }
        }
      ],
      values: generateMixtureGaussianSamples()
    }
  ],
  type: 'histogram',
  xField: 'x0',
  x2Field: 'x1',
  yField: 'frequency',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Histogram of Gaussian data'
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'frequency'
      },
      content: [
        {
          key: datum => datum['x0'] + '～' + datum['x1'],
          value: datum => datum['frequency']
        }
      ]
    }
  }
};

registerRegressionLine();
appendHistogramRegressionLineConfig(spec, [
  {
    type: 'kde', // supports 'kde' and 'ecdf'
    line: {
      style: {
  // const b = generateGaussian(80, 2.3, 0.08, 2); // cluster B
  // const c = generateGaussian(140, 9.3, 0.35, 3); // cluster C
  const outliers = [5.0, 6.2, 3.5, 12.0, 0.5];
  const arr = [...a, ...outliers];
  return arr.map(v => ({ value: v }));
}

const spec = {
  data: [
    {
      name: 'data1',
      transforms: [
        {
          type: 'bin',
          options: {
            step: 2,
            field: 'value',
            outputNames: { x0: 'x0', x1: 'x1', count: 'frequency' }
          }
        }
      ],
      values: generateMixtureGaussianSamples()
    }
  ],
  type: 'histogram',
  xField: 'x0',
  x2Field: 'x1',
  yField: 'frequency',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Histogram of Gaussian data'
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'frequency'
      },
      content: [
        {
          key: datum => datum['x0'] + '～' + datum['x1'],
          value: datum => datum['frequency']
        }
      ]
    }
  }
};

registerRegressionLine();
appendHistogramRegressionLineConfig(spec, [
  {
    type: 'kde', // 支持 'kde' 和 'ecdf'
    line: {
      style: {
        stroke: 'red',
        lineWidth: 2
      }
    },
    label: {
      text: 'KDE核密度估计'
    }
  },
  {
    type: 'ecdf', // 支持 'kde' 和 'ecdf'
    line: {
      style: {
        stroke: 'green',
        lineWidth: 2
      }
    },
    label: {
      text: '经验累积分布函数（ECDF）'
    }
  }
]);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### Configuration Type Definition

The regression line configuration type is defined as follows:

```ts
{
  /**
   * Type of regression line
   */
  type: 'kde' | 'ecdf';
  /**
   * Color value
   */
  color?: string;
  /**
   * Regression line configuration
   */
  line?: {
    /**
     * Whether to show the series label
     * @default true
     */
    visible?: boolean;
    /**
     * Line style
     */
    style?: ILineGraphicAttribute;
  };
  /**
   * Regression line formula label
   */
  label?: {
    /**
     * Whether to show the label
     */
    visible?: boolean;
    /**
     * Label text
     */
    text: string;
    /**
     * Label style
     */
    style?: ITextGraphicAttribute;
  };
}
```

## Scatter Plot / Series Example

### Example

Use `appendScatterRegressionLineConfig` to add regression overlays to scatter plots. You can configure `degree`, `type`, styles, and more:

```javascript livedemo
/** --Add the following code in your business usage-- */
// When using in your project, make sure to install @visactor/vchart-extension with the same version as vchart
// import { registerRegressionLine, appendScatterRegressionLineConfig } from '@visactor/vchart-extension';
/** --Add the above code in your business usage-- */

/** --Remove the following code in your business usage-- */
const { registerRegressionLine, appendScatterRegressionLineConfig } = VChartExtension;
/** --Remove the above code in your business usage-- */

const data = [
  // ... (data omitted for brevity)
];

// Chart configuration
const spec = {
  type: 'common',
  series: [
    {
      type: 'scatter',
      xField: 'milesPerGallon',
      yField: 'horsepower',
      point: {
        state: {
          hover: {
            scaleX: 1.2,
            scaleY: 1.2
          }
        },
        style: {
          fillOpacity: 0.25
        }
      }
    }
  ],
  tooltip: {
    dimension: {
      visible: true
    },
    mark: {
      title: true,
      content: [
        {
          key: d => d.name,
          value: d => d.y
        }
      ]
    }
  },
  crosshair: {
    yField: {
      visible: true,
      line: {
        visible: true,
        type: 'line'
      },
      label: {
        visible: true // label is off by default
      }
    },
    xField: {
      visible: true,
      line: {
        visible: true,
        type: 'line'
      },
      label: {
        visible: true // label is off by default
      }
    }
  },
  axes: [
    {
      title: {
        visible: true,
        text: 'Horse Power'
      },
      orient: 'left',
      range: { min: 0 },
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
  data: [
    {
      id: 'data',
      values: data.flat()
    }
  ]
};
registerRegressionLine();
appendScatterRegressionLineConfig(spec, [
  {
    type: 'polynomial', // Supports 4 types: 'linear' | 'logisitc' | 'lowess' | 'polynomial'
    polynomialDegree: 3,
    color: 'red',
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
      text: '3rd Degree Polynomial Regression'
    }
  },
  {
    type: 'linear',
    color: 'green',
    label: {
      text: 'Linear Regression'
    }
  }
]);
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

### Configuration Type Definition

The regression line configuration type is defined as follows:

```ts
{
  /**
   * Type of regression line
   */
  type: 'linear' | 'logisitc' | 'lowess' | 'polynomial';
  /**
   * Degree of polynomial regression, only valid when type is polynomial
   */
  polynomialDegree?: number;
  /**
   * Color value
   */
  color?: string;
  /**
   * Regression line configuration
   */
  line?: {
    /**
     * Whether to show the series label
     * @default true
     */
    visible?: boolean;
    /**
     * Line style
     */
    style?: ILineGraphicAttribute;
  };
  /**
   * Regression line formula label
   */
  label?: {
    /**
     * Whether to show the label
     */
    visible?: boolean;
    /**
     * Label text
     */
    text: string;
    /**
     * Label style
     */
    style?: ITextGraphicAttribute;
  };
  /**
   * Confidence interval
   */
  confidenceInterval?: {
    visible?: boolean;
    style?: IAreaGraphicAttribute;
  };
}
```

## Notes and Recommendations

- Histogram regression relies on bin output fields (such as `x0/x1/count`). Make sure the `outputNames` in the `bin` transform match what the regression component expects.
- Confidence interval calculation incurs extra overhead. For large datasets or interactive updates, it is recommended to turn it off.
- The `append*` methods directly modify the input `spec`. If you need to keep the original spec, deep copy it before applying changes.
