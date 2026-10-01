---
title: 0 VChart 工程化    

key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# 0.1 启动 demo

## 0.1.1 Fork 项目

在 Github 上，你需要 Fork VChart 项目。    

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/sourcecode/img/XgFMbjw62o7QnDxfi62cfY6znKe.gif' alt='' width='1000' height='auto' />

## 0.1.2 克隆项目

在你 fork 的仓库中，点击 `Code` 按钮，复制项目地址。然后使用 git clone 命令克隆项目到本地。例如：    

```bash
git clone https://github.com/your-username/VChart.git    

```
克隆完毕后需要添加 VChart 的远程地址。    

```bash
git remote add upstream https://github.com/VisActor/VChart.git    

```
这样以后你就可以从 VChart 的远程地址获取最新的源码。    

```bash
git pull upstream develop    

```
## 0.1.3 启动 demo

我们是用 [@microsoft/rush](https://rushjs.io/) 来管理 monorepo。所以先安装 rush。    

```bash
npm install -g @microsoft/rush    

```
接下来执行命令启动 demo。    

```typescript
*安装依赖*
$ rush update
*启动 vchart 的demo页*
$ rush start
*启动 react-vchart 的demo页*
$ rush react
*启动本地文档站点*
$ rush docs    

```
## 0.1.4 启动 demo 的时候发生了什么？

当你运行 `rush start` 的时候，会启动 vchart 的 demo 页。可是具体发生了什么呢？    

首先我们在 `command-line.json` 中配置了 `start` 命令：    

```json
{"commandKind": "global","name": "start","summary": "Start the development server","description": "Run this command to start vchart development server","shellCommand": "rush run -p @visactor/vchart -s start"},    

```
所以我们得知 start 命令会执行 `rush run -p @visactor/vchart -s start` 命令。    

让我详细解释 `rush run -p @visactor/vchart -s start` 这个命令：    

这是一个 Rush 工具的命令，可以拆解为以下几个部分：    

1. `rush run`：Rush 的子命令，用于在 monorepo 中运行特定项目的 npm 脚本    

1. `-p @visactor/vchart`：`-p` 或 `--project` 参数，指定要运行脚本的项目名称，这里指定的是 @visactor/vchart 项目    

1. `-s start`：`-s` 或 `--script` 参数，指定要运行的 npm 脚本名称，这里要运行的是 start 脚本    

根据代码库，我们可以看到这个命令最终会执行 @visactor/vchart 包中 package.json 定义的 start 脚本：    

```bash
ts-node __tests__/runtime/browser/scripts/initVite.ts && vite serve __tests__/runtime/browser    

```
这个命令前半部分是运行初始化脚本 `initVite.ts`，它的主要作用是生成 local 版本的 `vite.config.local.ts` 和 `index.page.local.ts` 文件，这两个文件是被 git 忽略的，用于本地开发的配置，后面会详细讲到。    

后半部分的脚本 `vite serve __tests__/runtime/browser`是启动 demo 网页。    

## 0.1.5 如何使用 `index.page.local.ts`

该文件的默认内容为    

```xml
import './test-page/area';    

```
笼统的来说，它可以用来指定启动不同的 chart 页面。实际上它就是会运行不同文件的 VChart 表格生成代码，来达到网页启动不同的 chart 页面的效果。所以你只要 import 不同的文件，就可以启动不同的 chart 页面。    

## 0.1.6 如何使用 `vite.config.local.ts`

这个文件主要用来配置端口和本地包。比如下面的配置：    

```xml
export default {
  *// 启动端口*port: 4000,
  resolve: {
    alias: {
      '@visactor/vgrammar-core': '/path/to/visactor/VGrammar/packages/vgrammar-core/src/index.ts',
      '@visactor/vgrammar-util': '/path/to/visactor/VGrammar/packages/vgrammar-util/src/index.ts',
      '@visactor/vgrammar-wordcloud': '/path/to/visactor/VGrammar/packages/vgrammar-wordcloud/src/index.ts',
      '@visactor/vgrammar-wordcloud-shape': '/path/to/visactor/VGrammar/packages/vgrammar-wordcloud-shape/src/index.ts',
      '@visactor/vgrammar-sankey': '/path/to/visactor/VGrammar/packages/vgrammar-sankey/src/index.ts',
      '@visactor/vgrammar-hierarchy': '/path/to/visactor/VGrammar/packages/vgrammar-hierarchy/src/index.ts',
      '@visactor/vgrammar-projection': '/path/to/visactor/VGrammar/packages/vgrammar-projection/src/index.ts',
      '@visactor/vgrammar-coordinate': '/path/to/visactor/VGrammar/packages/vgrammar-coordinate/src/index.ts',
      '@visactor/vgrammar-venn': '/path/to/visactor/VGrammar/packages/vgrammar-venn/src/index.ts',
      '@visactor/vscale': '/path/to/visactor/VUtil/packages/vscale/src/index.ts',
      '@visactor/vdataset': '/path/to/visactor/VUtil/packages/vdataset/src/index.ts',
      '@visactor/vutils': '/path/to/visactor/VUtil/packages/vutils/src/index.ts',
      '@visactor/vrender-core': '/path/to/visactor/VRender/packages/vrender-core/src/index.ts',
      '@visactor/vrender-kits': '/path/to/visactor/VRender/packages/vrender-kits/src/index.ts',
      '@visactor/vrender-components': '/path/to/visactor/VRender/packages/vrender-components/src/index.ts'
    }
  }
};    

```
它把启动端口配置为 4000，并且配置了一系列的本地包，这样你的 VChart 在调试时会依赖这些本地包，你对上游本地包的改动会实时生效，方便调试一些和上游有关的 bug，如果你不需要这个功能，去掉这些配置即可。    

# 0.2 VChart 工程化详解

## 0.2.1 项目结构

VChart 是一个使用 Rush 管理的 monorepo 项目，主要包含以下几个部分：    

核心包：    

1. @visactor/vchart - 核心图表库    

1. @visactor/react-vchart - React 封装    

1. @visactor/openinula-vchart - OpenInula 封装    

1. @visactor/taro-vchart - Taro 封装    

1. @visactor/lark-vchart - 飞书封装    

1. @visactor/wx-vchart - 微信小程序封装    

1. @visactor/vchart-schema - 图表配置 Schema    

1. @visactor/vchart-types - TypeScript 类型定义    

1. @visactor/vutils-extension - 工具函数扩展    

1. @visactor/tt-vchart - 字节小程序封装    

工具包：    

1. @internal/bundler - 打包工具    

1. @internal/typescript-json-schema - TypeScript 类型定义生成工具    

1. @internal/story-player - 故事播放器    

1. @internal/bugserver-trigger - Bug 服务触发器    

## 0.2.2 文档系统

文档的内容都存储在 `docs/assets` 文件夹下，比如包含:    

*  API 文档    

*  示例代码    

*  教程文档    

*  配置项文档    

*  主题文档    

## 0.2.3 开发命令

*  rush update - 安装依赖    

*  rush start - 启动 vchart 开发服务    

*  rush react - 启动 react-vchart 开发服务    

*  rush docs - 启动文档开发服务    



 # 本文档由以下人员修正整理 
 [玄魂](https://github.com/xuanhun)