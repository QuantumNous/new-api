# 字节小程序

我们为字节小程序提供 `@visactor/tt-vchart` 图表组件库，可以通过 `npm` 引入。

示例项目: [examples](https://github.com/VisActor/VChart/tree/main/packages/tt-vchart/gallery) 使用飞书开发者工具导入即可。

## 环境要求

字节小程序 基础库版本 > 2.34.0

## API

`@visactor/tt-vchart` 图表组件使用示例如下：

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

- `canvasId` 为图表 id，与 dom 的 id 一致，请确保**id 不重复**。
- `spec` 是 VChart 的核心概念，跨端组件的 spec 与 PC 端保持一致。图表配置例子可以参见 [VChart 图表示例](../../../../example)。对于不熟悉 VChart 的用户，可以参见[快速开始 VChart](../../Getting_Started) 教程。
- `styles` 为图表容器样式，可以用于控制图表宽高等样式。
- `events` 是一个对象数组，用于注册一系列事件，其定义如下，具体的事件名称、事件筛选配置以及回调函数的参数详见 [VChart 事件 API](todo)

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
  /**
   * 事件回调
   */
  handler: (event) => void;
}
```

- `onChartInit` 是一个回调函数，在图表初始化完成后调用。其中的入参 instance 为图表的实例，可用于注册事件、主题等；
- `onChartReady` 是一个回调函数，在图表完成渲染后调用；

更多功能请查看[VChart 官方网站](visactor.io/vchart)

## 如何使用

### 前提

npm 能力在基础库 2.12.0 以上版本才开始支持，因此开发者需要在抖音开放平台·开发者平台指定最低基础库版本为 2.12.0，保证小程序不会运行在低版本基础库上。具体请阅读 [npm 能力](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/developer-instrument/development-assistance/npm/)。

### 通过 npm 使用

#### Step1: 安装图表组件

在小程序 package.json 所在的目录中执行命令安装 npm 包：

```bash
$ npm install @visactor/tt-vchart
```

**说明**

- 参与构建 npm 的 package.json 需要在 project.config.json 定义的 miniprogramRoot 之内。 miniprogramRoot 字段不存在时，miniprogramRoot 指向的就是 project.config.json 所在的目录。
- 打包构建 npm 依赖时根据 package.json 的 dependencies 字段。 devDependencies 里的依赖也可以在开发过程中被安装使用而不会参与到构建中。

#### Step2: 构建 npm

1. 编辑器“侧边栏” 打开 NPM 模块的面板
2. 点击 “构建 NPM” 按钮

![构建npm](https://sf1-cdn-tos.douyinstatic.com/obj/microapp/frontend/docs/images/image-1828882157442553.png)

构建完成后, 项目会出现 `miniprogram_npm` 的构建文件.

#### Step3: 创建 Demo 页面

结构如下:

```
├── pages
│   └── demo
│       └── index.js     # 页面js
│       ├── index.json   # 页面json配置
│       ├── index.ttml   # 页面xml结构
│       ├── index.ttss   # 页面样式
```

#### Step4: 引用组件

在 index.json 中配置如下内容即可:

```
{
  "usingComponents": {
    "chart": "ext://@visactor/tt-vchart/index"
  }
}
```

`ext://@visactor/tt-vchart/index` 是小程序端的特殊规则: 通过 npm 引用自定义组件, 路径引用的格式需要遵守: `ext://packageName/componentName`

其中

- `ext://` 为小程序规范的前缀.
- `packageName` 为 npm 包名
- `componentName` 为组件名称.

与我们的图表组件对应起来:

- `packageName` 为: `@visactor/tt-vchart`
- `componentName` 为: `index` (由 chartspace 组件库预设)

更加细致的描述, 请参考: [使用 npm](https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/developer-instrument/development-assistance/npm/#_%E4%BD%BF%E7%94%A8-npm)

#### Step5: 创建图表

1. 在 `index.ttml` 准备如下的 xml 结构:

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

2. 在 `index.js` 中准备图表的所需的配置

参考示例:

```js
Page({
  data: {
    // canvasId 图表唯一Id
    canvasId: 'chartId',
    // events 自定义事件
    events: [],
    // 样式字符串
    styles: `
      height: 50vh;
      width: 100%
    `,
    // 图表配置项
    spec: {
      type: 'pie',
      data: [
        {
          name: 'data1',
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
      valueField: 'value',
      legends: {
        visible: true
      }
    }
  },
  onLoad: function (options) {}
});
```

### 拷贝组件使用

通过 npm 安装后, 可以直接将`@visactor/tt-vchart/src`目录下的所有文件拷贝到自己的项目中. 自行设置 `usingComponents` 即可.

## 问题反馈

如果在使用过程中发现问题，欢迎在 [GitHub issues](https://github.com/VisActor/VChart/issues/new/choose) 中向我们反馈，非常感谢！
