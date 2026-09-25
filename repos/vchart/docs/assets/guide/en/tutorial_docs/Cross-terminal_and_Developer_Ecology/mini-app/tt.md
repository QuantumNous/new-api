# Byte Mini Program

We provide the `@visactor/tt-vchart` chart component library for Byte mini-programs, which can be imported through `npm`.

Example project: [examples](https://github.com/VisActor/VChart/tree/main/packages/tt-vchart/gallery) Import using Lark Developer Tools.

## Environment Requirements

Byte Mini Program basic library version > 2.34.0

## API

The use of the `@visactor/tt-vchart` chart component is shown below:

```xml
<chart
  canvasId="{{ canvasId }}"
  spec="{{ spec }}"
  styles="{{ styles }}"
  events="{{ events }}"
  onChartInit="{{ onChartInit }}"
  onChartReady="{{ onChartReady }}"
/>
```

- `canvasId` is the id of the chart, consistent with the id of the dom, please make sure **id is not repeated**.
- `spec` is the core concept of VChart, and the spec of the cross-end components is consistent with the PC end. Chart configuration examples can be found in [VChart Chart Examples](../../../../example). For users who are not familiar with VChart, you can refer to the [Getting Started with VChart](../../Getting_Started) tutorial.
- `styles` is the style of the chart container, which can be used to control chart width, height, and other styles.
- `events` is an array of objects used to register a series of events, defined as follows, specific event names, event filtering configurations, and callback function parameters refer to [VChart Event API](todo)

```ts
interface IEvent {
  /**
   * The name of the event
   */
  type: string;
  /**
   * Event filtering configuration in event API
   */
  query?: object;
  /**
   * Event callback
   */
  handler: (event) => void;
}
```

- `onChartInit` is a callback function called after the chart is initialized. The parameter instance is the instance of the chart, which can be used to register events, themes, etc.
- `onChartReady` is a callback function called after the chart is rendered.

For more features, please visit [VChart Official Website](visactor.io/vchart)

## How to Use

### Prerequisites

The npm capability is only supported in the basic library version 2.12.0 and above, so developers need to specify the minimum basic library version as 2.12.0 on the Douyin Open Platform Developer Platform to ensure that the applet does not run on a lower version of the basic library. For more information, please read [npm Capability](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/developer-instrument/development-assistance/npm/).

### Use with npm

#### Step1: Install chart components

Execute the command to install the npm package in the directory where the applet package.json is located:

```bash
$ npm install @visactor/tt-vchart
```

**Description**

- The package.json participating in the npm build needs to be defined within the miniprogramRoot specified in project.config.json. When the miniprogramRoot field does not exist, the miniprogramRoot points to the directory where the project.config.json is located.
- The npm dependencies are built based on the dependencies field in package.json. Dependencies in devDependencies can also be installed and used during development but will not be included in the build.

#### Step2: Build npm

1. Open the NPM module panel in the editor's "sidebar"
2. Click the "Build NPM" button

![Build npm](https://sf1-cdn-tos.douyinstatic.com/obj/microapp/frontend/docs/images/image-1828882157442553.png)

After the build is completed, a `miniprogram_npm` build file will appear in the project.

#### Step3: Create Demo Page

The structure is as follows:

```
├── pages
│   └── demo
│       └── index.js     # Page js
│       ├── index.json   # Page json configuration
│       ├── index.ttml   # Page xml structure
│       ├── index.ttss   # Page style
```

#### Step4: Reference Component

Configure the following content in index.json:

```
{
  "usingComponents": {
    "chart": "ext://@visactor/tt-vchart/index"
  }
}
```

`ext://@visactor/tt-vchart/index` is a special rule for mini-program terminals: to reference custom components through npm, the path reference format needs to be followed: `ext://packageName/componentName`

In which,

- `ext://` is the prefix specified by the mini-program
- `packageName` is the npm package name
- `componentName` is the component name

Corresponding to our chart components:

- `packageName` is: `@visactor/tt-vchart`
- `componentName` is: `index` (preset by chartspace component library)

For a more detailed description, please refer to: [Using npm](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/developer-instrument/development-assistance/npm/#_%E4%BD%BF%E7%94%A8-npm)

#### Step5: Create Chart

1. Prepare the following XML structure in `index.ttml`:

```xml
<view tt:if="{{ spec }}">
  <chart
    canvasId="{{ canvasId }}"
    spec="{{ spec }}"
    styles="{{ styles }}"
    events="{{ events }}"
    onChartInit="{{ onChartInit }}"
    onChartReady="{{ onChartReady }}"
  />
</view>
```

2. Prepare the chart configuration required in `index.js`.

Refer to the example:

```js
Page({
  data: {
    // canvasId Unique Chart Id
    canvasId: 'chartId',
    // events Custom events
    events: [],
    // Style string
    styles: `
      height: 50vh;
      width: 100%
    `,
    // Chart configuration options
    spec: {
      type: 'pie',
      data: [
        {
          name: 'data1',
          values: [
            { value: 335, name: 'Direct access' },
            { value: 310, name: 'Email marketing' },
            { value: 274, name: 'Allied advertising' },
            { value: 123, name: 'Search engine' },
            { value: 215, name: 'Video advertising' }
          ]
        }
      ],
      outerRadius: 0.6,
      categoryField: 'name',
      valueField: 'value',
      legends: {
        visible: true
      }
    }
  },
  onLoad: function (options) {}
});
```

### Use by copying components

After installing with npm, you can directly copy all files from the `@visactor/tt-vchart/src` directory to your own project. Set `usingComponents` yourself.

## Feedback

If you encounter any issues during use, please feel free to raise them in [GitHub issues](https://github.com/VisActor/VChart/issues/new/choose). We appreciate your feedback!
