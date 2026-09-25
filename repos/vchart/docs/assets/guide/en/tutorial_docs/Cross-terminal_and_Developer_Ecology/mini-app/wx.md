# WeChat Mini Program

## Prerequisites must read

WeChat Mini Program limits the code package of the Mini Program to not exceed 2MB due to the consideration of the Mini Program startup speed. The vchart product of the WeChat Mini Program rendering environment we currently built already has 1.82M, so to ensure the package size, we recommend that users Manually introduce vchart to build products for use on WeChat mini programs. We will explain the usage in detail below.

We will still retain the `@visactor/wx-vchart` package, and we will continue to optimize the package size in the future. At the same time, we will provide **online customization** tools to allow users to build products on demand to better control the package size.

## Manually introduce vchart build product

Starting from version 1.7.0, we have provided a simple version of the vchart build product by default for WeChat mini programs. The chart types and components it contains are as follows:

1. Chart types: line chart, area chart, column chart, pie chart and column-line combination chart
2. Component types: axis, discrete legend, tooltip, crosshair and label

Address: [index-wx-simple.min.js](https://github.com/VisActor/VChart/tree/main/packages/vchart/dist/index-wx-simple.min.js)

If the simple version of the vchart build product we currently provide by default can meet your needs, then you can quote the script first, and we will provide **online customization** tools later to allow users to build products on demand.

The following is a detailed introduction to how to use it.

### how to use

In addition to reading the instructions below, you can also directly move to the demo **[wx-example](https://github.com/VisActor/wx-example)**.

#### Used by encapsulating custom components

This step can directly copy the [chart](https://github.com/VisActor/wx-example/tree/main/miniprogram/pages/chart) in [wx-example](https://github.com/VisActor/wx-example) folder, **then replace chart/vchart/index.js with your vchart build product**. This code is consistent with the component encapsulation code in `@visactor/wx-vchart`. Please see the source code for specific packaging logic.

#### Use custom components

1. Reference components

Just configure the following content in index.json, and use `chart` to customize the component.

```javascript
{
   "usingComponents": {
     "chart": "../chart/index"
   }
}
```

2. Create a chart

Prepare the following xml structure in `index.ttml`:

```xml
<chart
   canvas-id="chart"
   spec="{{ spec }}"
   styles="{{ styles }}"
   events="{{ events }}"
   bind:chartinit="onChartInit"
   bind:chartready="onChartReady"
/>
```

Prepare the required configuration for the chart in `index.js`

```javascript
Page({
  data: {
    spec: {},
    events: [],
    options: {}
  },
  chartType: '',
  stage: undefined,
  onLoad(options) {
    this.chartType = options.name || '';
    const spec = {
      type: 'bar',
      data: [
        {
          id: 'barData',
          values: [
            { type: 'Autocracies', year: '1930', value: 129 },
            { type: 'Autocracies', year: '1940', value: 133 },
            { type: 'Autocracies', year: '1950', value: 130 },
            { type: 'Autocracies', year: '1960', value: 126 },
            { type: 'Autocracies', year: '1970', value: 117 },
            { type: 'Autocracies', year: '1980', value: 114 },
            { type: 'Autocracies', year: '1990', value: 111 },
            { type: 'Autocracies', year: '2000', value: 89 },
            { type: 'Autocracies', year: '2010', value: 80 },
            { type: 'Autocracies', year: '2018', value: 80 },
            { type: 'Democracies', year: '1930', value: 22 },
            { type: 'Democracies', year: '1940', value: 13 },
            { type: 'Democracies', year: '1950', value: 25 },
            { type: 'Democracies', year: '1960', value: 29 },
            { type: 'Democracies', year: '1970', value: 38 },
            { type: 'Democracies', year: '1980', value: 41 },
            { type: 'Democracies', year: '1990', value: 57 },
            { type: 'Democracies', year: '2000', value: 87 },
            { type: 'Democracies', year: '2010', value: 98 },
            { type: 'Democracies', year: '2018', value: 99 }
          ]
        }
      ],
      xField: ['year', 'type'],
      yField: 'value',
      seriesField: 'type',
      legends: {
        visible: true,
        orient: 'top',
        position: 'start'
      },
      axes: [
        {
          orient: 'left',
          label: {
            formatMethod: text => `$${text}`
          }
        }
      ]
    };
    this.setData({
      //Set data
      spec
    });
  },
  onChartInit(event: any) {
    console.log('chart instance initialization completed', event);
  },

  onChartReady(event: any) {
    console.log('chart instance rendering completed', event);
  }
});
```

## Use @visactor/wx-vchart

`@visactor/wx-vchart` is a chart component library encapsulated by VChart for [WeChat applet](https://developers.weixin.qq.com/miniprogram/dev/framework/), used to support [WeChat applet] Chart rendering on (https://developers.weixin.qq.com/miniprogram/dev/framework/). Supports introduction through `npm`.

This component library only encapsulates the environment. The configuration items and API are exactly the same as VChart. For the corresponding documentation, see [VChart](https://www.visactor.io/vchart).

### Environmental requirements

[WeChat Developer Tools](https://developers.weixin.qq.com/miniprogram/dev/devtools/devtools.html)

###API

Examples of using the `@visactor/wx-vchart` chart component are as follows:

```xml
<chart
   canvas-id="chart"
   spec="{{ spec }}"
   styles="{{ styles }}"
   events="{{ events }}"
   bind:chartinit="onChartInit"
   bind:chartready="onChartReady"
/>
```

- `canvas-id` is the chart id, which is consistent with the id of the dom. Please ensure that the id does not repeat.
- `spec` is the core concept of VChart. The spec of cross-end components is consistent with the PC side. For chart configuration examples, please see [VChart Chart Example](https://www.visactor.io/vchart/example). For users who are not familiar with VChart, you can refer to the [Quickly Start VChart](https://www.visactor.io/vchart/guide/tutorial_docs/Getting_Started) tutorial.
- `styles` is the chart container style, which can be used to control the chart width and height.
- `events` is an object array used to register a series of events, which is defined as follows. For details on the specific event name, event filtering configuration and callback function parameters, see [VChart Event API](https://www.visactor.io/vchart/api/API/event)

```ts
interface IEvent {
  /**
   *The name of the event
   */
  type: string;
  /**
   * Event filtering configuration in event API
   */
  query?: object;
  handler: (event) => void;
}
```

- `bind:chartinit` is a callback function called after the chart initialization is completed.
- `bind:chartready` is a callback function that is called after the chart has finished rendering.

### how to use

In addition to reading the instructions below, you can also go directly to [wx-vchart-example](https://github.com/VisActor/wx-vchart-example).

#### Prerequisite

Before using the VChart WeChat applet component library, please make sure you have understood the relevant documentation of the WeChat open platform.

- [Custom component](https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/)
- [npm support](https://developers.weixin.qq.com/community/develop/article/doc/0008aecec4c9601e750be048d51c13)

#### Step1: Enable npm capabilities

Open Editor > Tools > Build npm. For specific operations, please read [Enable npm capabilities](https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html).

![Image](https://res.wx.qq.com/wxdoc/dist/assets/img/construction.408e13ae.png)

**It is important to note: the package.json file of the npm package needs to be within the miniprogramRoot defined by project.config.json. **

#### Step2: Install `@visactor/wx-vchart`

```bash
$ npm install @visactor/wx-vchart
```

#### Step3: Create demo page

Please use WeChat developer tools to create page templates

#### Step4: Reference components

Just configure the following content in index.json, and use `chart` to customize the component.

```javascript
{
   "usingComponents": {
     "chart": "@visactor/wx-vchart/index"
   }
}
```

#### Step5: Create a chart

1. Prepare the following xml structure in `index.ttml`:

```xml
<chart
   canvas-id="chart"
   spec="{{ spec }}"
   styles="{{ styles }}"
   events="{{ events }}"
   bind:chartinit="onChartInit"
   bind:chartready="onChartReady"
/>
```

2. Prepare the required configuration of the chart in `index.js`

```javascript
Page({
  data: {
    canvasId: 'chartId', // canvasId unique ID of the chart
    events: [], // events custom events
    styles: `
       height: 50vh;
       width: 100%
     `, // style character
    // Chart configuration items
    spec: {
      type: 'pie',
      data: [
        {
          id: 'data1',
          values: [
            { value: 335, name: 'Direct access' },
            { value: 310, name: 'Email Marketing' },
            { value: 274, name: 'affiliate advertising' },
            { value: 123, name: 'search engine' },
            { value: 215, name: 'Video Advertisement' }
          ]
        }
      ],
      outerRadius: 0.6,
      categoryField: 'name',
      valueField: 'value'
    }
  },
  onLoad: function (options) {}
});
```

### How to develop

Use WeChat developer tools and select [Mini Program] to import this project.

## feedback

If you find any problems during use, please give us feedback in [GitHub issues](https://github.com/VisActor/VChart/issues/new/choose). Thank you very much!
