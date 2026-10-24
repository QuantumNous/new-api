# function

Since version `1.7.0`, VChart provides methods related to registering expression functions. Developers can register global or instance functions to meet business needs and solve the problem that scene functions such as mini programs and Feishu cards cannot be serialized. In principle, registration functions can be applied wherever user-defined callback functions are supported.

This tutorial will introduce the use of registered functions through two examples. For more details, please refer to [Function API](../../../api/API/function)

## Global registration function

When using a global registration function, call the chart method `registerFunction` to register a custom function, and callback processing will be performed at runtime, as shown in the example below.

```ts
  labelFormat(key: string) {
    return key + "test";
  }

  // the user defines a function named `renderCharts` to encapsulate chart rendering
  renderCharts(json: string) {

    // Global registration function
    VChart.registerFunction("labelFormat",this.labelFormat);

    const vchart = new VChart(json, { dom: CONTAINER_ID });

    vchart.renderSync();
  }
```

In the following example, a custom global function `labelFormat` is used when setting the `formatMethod` of `label`:

```javascript livedemo
function labelFormat(key) {
  return key + 'test';
}

// Global registration function
VChart.registerFunction('labelFormat', labelFormat);

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
  yField: 'sales',
  label: {
    visible: true,
    formatMethod: 'labelFormat'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

## Instance registration function

When using an instance to register a function, call the instance method `registerFunction` to register a custom function, and callback processing will be performed at runtime, as shown in the example below.

```ts
  labelFormat(key: string) {
    return key + "test";
  }

  // the user defines a function named `renderCharts` to encapsulate chart rendering
  renderCharts(json: string) {

    const vchart = new VChart(json, { dom: CONTAINER_ID });

    // Instance registration function
    vchart.registerFunction("labelFormat",this.labelFormat);

    vchart.renderSync();
  }
```

In the following example, the custom instance function `labelFormat` is used when setting the `formatMethod` of `label`:

```javascript livedemo
function labelFormat(key) {
  return key + 'test';
}

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
  yField: 'sales',
  label: {
    visible: true,
    formatMethod: 'labelFormat'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

// Instance registration function
vchart.registerFunction('labelFormat', labelFormat);

vchart.renderSync();
```
