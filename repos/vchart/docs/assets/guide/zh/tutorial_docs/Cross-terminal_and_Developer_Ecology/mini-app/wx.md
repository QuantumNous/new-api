# 微信小程序

## 前提必读

微信小程序出于对小程序启动速度的考虑，限制了小程序的代码包不能超过 2MB，而我们目前构建的微信小程序渲染环境的 vchart 产物已经有 1.82M，所以保证包大小，我们建议用户手动引入 vchart 构建产物的方式来在微信小程序上使用，在下文我们会详细讲解使用方式。

`@visactor/wx-vchart` 包我们仍会保留，后续我们会继续对包体积进行优化，同时会提供**在线定制**的工具让用户按需构建产物，以更好得控制包大小。

## 手动引入 vchart 构建产物

自 1.7.0 版本开始，我们为微信小程序默认提供了简单版本的 vchart 构建产物，它包含的图表类型和组件如下：

1. 图表类型：折线图、面积图、柱状图、饼图以及柱线组合图
2. 组件类型：坐标轴，离散图例，tooltip， crosshair 以及 label

地址：[index-wx-simple.min.js](https://github.com/VisActor/VChart/tree/main/packages/vchart/dist/index-wx-simple.min.js)

如果目前我们默认提供的简单版本的 vchart 构建产物能满足你的需求，那么你就可以先引用该脚本，后续我们会提供**在线定制**的工具让用户按需构建产物。

下面具体介绍下使用方式。

### 如何使用

除了阅读下面的使用说明，也可以直接移步示例 demo **[wx-example](https://github.com/VisActor/wx-example)**。

#### 通过封装自定义组件使用

这一步可以直接拷贝 [wx-example](https://github.com/VisActor/wx-example) 中的 [chart](https://github.com/VisActor/wx-example/tree/main/miniprogram/pages/chart) 文件夹，**然后将 chart/vchart/index.js 替换成你的 vchart 构建产物**，该代码同 `@visactor/wx-vchart` 中的组件封装代码一致。具体的封装逻辑详见源码。

#### 使用自定义组件

1. 引用组件

在 index.json 中配置如下内容即可，使用 `chart` 自定义组件。

```javascript
{
  "usingComponents": {
    "chart": "../chart/index"
  }
}
```

2. 创建图表

在 `index.ttml` 准备如下的 xml 结构:

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

在 `index.js` 中准备图表的所需的配置

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
      // 设置数据
      spec
    });
  },
  onChartInit(event: any) {
    console.log('chart 实例初始化完成', event);
  },

  onChartReady(event: any) {
    console.log('chart 实例渲染完成', event);
  }
});
```

## 使用 @visactor/wx-vchart

`@visactor/wx-vchart` 是 VChart 为[微信小程序](https://developers.weixin.qq.com/miniprogram/dev/framework/)封装的图表组件库，用于支持[微信小程序](https://developers.weixin.qq.com/miniprogram/dev/framework/)上的图表渲染。支持通过 `npm` 方式引入。

该组件库只是做了环境的封装，配置项以及 API 同 VChart 完全一致，对应的文档详见 [VChart](https://www.visactor.io/vchart)。

### 环境要求

[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/devtools.html)

### API

`@visactor/wx-vchart` 图表组件使用示例如下：

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

- `canvas-id` 为图表 id，与 dom 的 id 一致，请确保 id 不重复。
- `spec` 是 VChart 的核心概念，跨端组件的 spec 与 PC 端保持一致。图表配置例子可以参见 [VChart 图表示例](https://www.visactor.io/vchart/example) 。对于不熟悉 VChart 的用户，可以参见 [快速开始 VChart](https://www.visactor.io/vchart/guide/tutorial_docs/Getting_Started) 教程。
- `styles` 为图表容器样式，可以用于控制图表宽高等样式。
- `events` 是一个对象数组，用于注册一系列事件，其定义如下，具体的事件名称、事件筛选配置以及回调函数的参数详见 [VChart 事件 API](https://www.visactor.io/vchart/api/API/event)

```ts
interface IEvent {
  /**
   * 事件的名称
   */
  type: string;
  /**
   * 事件 API 中的事件筛选配置
   */
  query?: object;
  handler: (event) => void;
}
```

- `bind:chartinit` 是一个回调函数，在图表初始化完成后调用。
- `bind:chartready` 是一个回调函数，在图表完成渲染后调用。

### 如何使用

除了阅读下面的使用说明，也可以直接移步 [wx-vchart-example](https://github.com/VisActor/wx-vchart-example)。

#### 前提

在使用 VChart 微信小程序组件库前，请确保你已经了解过微信开放平台的相关文档介绍。

- [自定义组件](https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/)
- [npm 支持](https://developers.weixin.qq.com/community/develop/article/doc/0008aecec4c9601e750be048d51c13)

#### Step1: 开启 npm 能力

开启编辑器 > 工具 > 构建 npm，具体操作可阅读[开启 npm 能力](https://developers.weixin.qq.com/miniprogram/dev/devtools/npm.html)。

![Image](https://res.wx.qq.com/wxdoc/dist/assets/img/construction.408e13ae.png)

**务必注意：npm 包的 package.json 文件需要在 project.config.json 所定义的 miniprogramRoot 内。**

#### Step2: 安装 `@visactor/wx-vchart`

```bash
$ npm install @visactor/wx-vchart
```

#### Step3: 创建 demo 页面

请使用微信开发者工具创建页面模板

#### Step4: 引用组件

在 index.json 中配置如下内容即可，使用 `chart` 自定义组件。

```javascript
{
  "usingComponents": {
    "chart": "@visactor/wx-vchart/index"
  }
}
```

#### Step5: 创建图表

1.  在 `index.ttml` 准备如下的 xml 结构:

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

2.  在 `index.js` 中准备图表的所需的配置

```javascript
Page({
  data: {
    canvasId: 'chartId', // canvasId 图表唯一Id
    events: [], // events 自定义事件
    styles: `
      height: 50vh;
      width: 100%
    `, // 样式字符
    // 图表配置项
    spec: {
      type: 'pie',
      data: [
        {
          id: 'data1',
          values: [
            { value: 335, name: '直接访问' },
            { value: 310, name: '邮件营销' },
            { value: 274, name: '联盟广告' },
            { value: 123, name: '搜索引擎' },
            { value: 215, name: '视频广告' }
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

### 如何开发

使用微信开发者工具，选择【小程序】导入本项目即可。

## 问题反馈

如果在使用过程中发现问题，欢迎在 [GitHub issues](https://github.com/VisActor/VChart/issues/new/choose) 中向我们反馈，非常感谢！
