---
title: 0 VChart Engineering    

key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# 0.1 Start demo

## 0.1.1 Fork the project

On Github, you need to Fork the VChart project.    


<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/sourcecode/img/XgFMbjw62o7QnDxfi62cfY6znKe.gif' alt='' width='1000' height='auto' />

## 0.1.2 Clone the Project

In the repository you forked, click the `Code` button to copy the project address. Then use the git clone command to clone the project locally. For example:    

```bash
git clone https://github.com/your-username/VChart.git    

```
After cloning, you need to add the remote address of VChart.    

```bash
git remote add upstream https://github.com/VisActor/VChart.git    

```
This way, you can get the latest source code from the remote address of VChart.    

```bash
git pull upstream develop    

```
## 0.1.3 Start demo

We use [@microsoft/rush](https://rushjs.io/) to manage the monorepo. So, first install rush.


```bash
npm install -g @microsoft/rush    

```
Next, execute the command to start the demo.    

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
## 0.1.4 What happens when starting the demo?

When you run `rush start`, it will launch the demo page of vchart. But what exactly happens?

First, we configured the `start` command in `command-line.json`:


```json
{"commandKind": "global","name": "start","summary": "Start the development server","description": "Run this command to start vchart development server","shellCommand": "rush run -p @visactor/vchart -s start"},    

```
So we know that the start command will execute the `rush run -p @visactor/vchart -s start` command.    

Let me explain the `rush run -p @visactor/vchart -s start` command in detail:    

This is a command from the Rush tool, which can be broken down into the following parts:    

1. `rush run`: A subcommand of Rush, used to run specific project npm scripts in a monorepo    

1. `-p @visactor/vchart`: The `-p` or `--project` parameter specifies the project name for which the script is to be run, here it specifies the @visactor/vchart project    

1. `-s start`: The `-s` or `--script` parameter specifies the npm script name to be run, here the start script is to be run    

According to the codebase, we can see that this command will eventually execute the start script defined in the package.json of the @visactor/vchart package:    

```bash
ts-node __tests__/runtime/browser/scripts/initVite.ts && vite serve __tests__/runtime/browser    

```
The first part of this command runs the initialization script `initVite.ts`, which mainly generates the local version files `vite.config.local.ts` and `index.page.local.ts`. These files are ignored by git and are used for local development configuration, which will be explained in detail later.

The second part of the script `vite serve __tests__/runtime/browser` is to launch the demo webpage.

## 0.1.5 How to use `index.page.local.ts`

The default content of this file is


```xml
import './test-page/area';    

```
Generally speaking, it can be used to specify launching different chart pages. In fact, it runs the VChart table generation code of different files to achieve the effect of launching different chart pages on the web. So you just need to import different files to launch different chart pages.    

## 0.1.6 How to use `vite.config.local.ts`

This file is mainly used to configure ports and local packages. For example, the following configuration:    

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

# 0.2 Detailed Explanation of VChart Engineering

## 0.2.1 Project Structure

VChart is a monorepo project managed using Rush, mainly consisting of the following parts:    

Core Packages:    

1. @visactor/vchart - Core chart library    

1. @visactor/react-vchart - React wrapper    

1. @visactor/openinula-vchart - OpenInula wrapper    

1. @visactor/taro-vchart - Taro wrapper    

1. @visactor/lark-vchart - Lark wrapper    

1. @visactor/wx-vchart - WeChat Mini Program wrapper    

1. @visactor/vchart-schema - Chart configuration schema    

1. @visactor/vchart-types - TypeScript type definitions    

1. @visactor/vutils-extension - Utility function extensions    

1. @visactor/tt-vchart - ByteDance Mini Program wrapper    

Tool Packages:    

1. @internal/bundler - Bundling tool    

1. @internal/typescript-json-schema - TypeScript type definition generation tool    

1. @internal/story-player - Story player    

1. @internal/bugserver-trigger - Bug service trigger    

## 0.2.2 Documentation System

The content of the documentation is stored in the `docs/assets` folder, including:    

*  API documentation    

*  Example code    

*  Tutorial documentation    

*  Configuration documentation    

*  Theme documentation    

## 0.2.3 Development Commands

*  rush update - Install dependencies    

*  rush start - Start the vchart development service    

*  rush react - Start the react-vchart development service    

*  rush docs - Start the documentation development service    


 # This document was revised and organized by the following personnel 
 [玄魂](https://github.com/xuanhun)