# @visactor/lark-vchart

`@visactor/lark-vchart` 是 VChart 为[飞书小程序](https://open.feishu.cn/document/client-docs/gadget/introduction/host-environment)封装的图表组件库，用于支持[飞书小程序](https://open.feishu.cn/document/client-docs/gadget/introduction/host-environment)上的图表渲染。支持通过 `npm` 方式引入。

该组件库只是做了环境的封装，配置项以及 API 同 VChart 完全一致，对应的文档详见 [VChart](https://www.visactor.io/vchart)。

## 环境要求

飞书版本 >= 3.45。
[飞书开发者工具](https://open.feishu.cn/document/uYjL24iN/ucDOzYjL3gzM24yN4MjN)

## API

`@visactor/lark-vchart` 图表组件使用示例如下：

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

## 如何使用

除了阅读下面的使用说明，也可以直接移步 [lark-vchart-example](https://github.com/VisActor/lark-vchart-example)。

### 前提

在使用 VChart 飞书小程序组件库前，请确保你已经了解过飞书开放平台的相关文档介绍。

- [自定义组件](https://open.feishu.cn/document/uYjL24iN/ugTOugTOugTO)
- [npm 支持](https://open.feishu.cn/document/uYjL24iN/uEzMzUjLxMzM14SMzMTN/npm-support)

### Step1: 开启 npm 能力

开启编辑器 > 详情 > 本地设置 > 使用 npm，具体操作可阅读[开启 npm 能力](https://open.feishu.cn/document/tools-and-resources/development-tools/npm-support#26ae361b)。

![Image](https://user-images.githubusercontent.com/135952300/251377256-32a8bcb1-9472-42ba-9b16-5d29438be4a8.png)

**务必注意：npm 包的 package.json 文件需要在 project.config.json 所定义的 miniprogramRoot 内。**

### Step2: 安装 `@visactor/lark-vchart`

```bash
$ npm install @visactor/lark-vchart
```

### Step3: 创建 demo 页面

结构如下：

```markdown
├── pages
│ └── demo
│ └── index.js # 页面 js
│ ├── index.json # 页面 json 配置
│ ├── index.ttml # 页面 xml 结构
│ ├── index.ttss # 页面样式
```

### Step4: 引用组件

在 index.json 中配置如下内容即可，使用 `chart` 自定义组件。

```javascript
{
  "usingComponents": {
    "chart": "@visactor/lark-vchart/index"
  }
}
```

### Step5: 创建图表

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

## 注意事项

1. 飞书小程序现阶段由于序列化问题，还不支持在 setData 以及 triggerEvent 中传递复杂对象及函数，只支持可序列号的数据。**因此 `events` 功能, `chartinit` 回调参数, `chartready` 回调参数暂不可用**

针对一些需要使用到 chart 实例的功能，目前可以通过 [selectComponent](https://open.feishu.cn/document/uYjL24iN/uADMx4CMwEjLwATM) ，在给组件 `<chart id="chart1">` 标明 id 属性后，通过 `selectComponent` 拿到图表实例，如下所示：

```javascript
onChartReady() {
	console.log('chart 实例渲染完成');
	this.selectComponent("#chart1", res => {
		const chartInstance = res && res.chart; // 获取 chart 实例
    console.log('获取 VChart 实例', chartInstance);
	});
},
```

## 问题反馈

如果在使用过程中发现问题，欢迎在 [GitHub issues](https://github.com/VisActor/VChart/issues/new/choose) 中向我们反馈，非常感谢！

## 如何开发

使用飞书开发者工具，选择【小程序】导入本项目即可。
