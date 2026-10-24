# 如何在 Taro 框架中使用图表组件？

## 问题描述

我想要在 Taro 框架中使用图表组件，有哪些开箱即用的图表库推荐吗？

## 解决方案

不同的图表库有不同的解决方案，下面介绍下 [VChart](https://www.visactor.io/vchart/) 图表库的使用，为了方便用户快速接入，VChart 封装了对应的图表组件：`@visactor/taro-vchart`，目前该组件支持的环境有：

- `tt` 字节小程序。
- `lark` 飞书小程序。
- `h5` 浏览器环境, 与`web`等价。
- `web` 浏览器环境, 与`h5`等价。

在使用上也非常简单，直接声明组件，传入对应的图表配置即可：

```
<VChart
  type="tt"
  spec={spec}
  canvasId="pie"
  style={{ height: '35vh', width: '100%' }}
  onChartInit={chart => {
    console.log('init pie');
  }}
  onChartReady={chart => {
    console.log('ready pie');
  }}
  onChartUpdate={chart => {
    console.log('update pie');
  }}
/>
```

## 代码示例

可以直接查看我们的代码仓库：[链接](https://github.com/VisActor/VChart/blob/develop/packages/taro-vchart/gallery/pages/chart/index.tsx)

## 结果展示

下面以飞书小程序为例，看一下 VChart 在飞书小程序上的表现：

Clone 下我们的仓库：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)，运行：

```
# clone
$ git clone git@github.com:VisActor/VChart.git
$ cd VChart
# 安装依赖
$ rush update
# 编译
$ rush run -p @visactor/taro-vchart -s dev:lark
```

然后用飞书开发者工具打开导入 `packages/taro-vchart/dist`即可。

![](/vchart/faq/90-1.png)

## 相关文档

- [跨端兼容说明](https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/mini-app/how)
- [Taro 使用教程](https://www.visactor.io/vchart/guide/tutorial_docs/cross-terminal_and_developer_ecology/taro)
