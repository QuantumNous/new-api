---
title: 1.搭建开发环境

key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Github 

## 1.1 注册账号

VisActor 团队通常在 github 上进行开发和 issue 维护，请打开 [Github 网站](https://github.com/)，点击右上角 `Sign up` 按钮，注册一个自己的账号，开启你开源之旅的第一步。

如果因为特殊情况，你无法打开 Github 站点，请告知我们并通过 [Gitee](https://gitee.com/VisActor/VChart) 进行项目开发。

## 1.2 Fork 项目

首先需要 fork 这个项目，进入[VChart 项目页面](https://github.com/VisActor/VChart)，点击右上角的 Fork 按钮



<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/LQbyb5XWgoV8w2x3D5uc8bIkn1c.gif' alt='' width='1000' height='auto'>



你的 github 帐号中会出现 xxxx(你的 github 用户名)/vchart 这个项目

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OuwMbtoyPof0S8xrisscWJ3Hneb.gif' alt='' width='849' height='auto'>

# 本地开发环境

## 2.1 安装 git

由于代码托管在 github 上，我们使用git做版本控制。

Git 是一种版本控制系统，用于跟踪和管理软件开发项目中的代码变更。它帮助开发者记录和管理代码的历史记录，方便团队协作、代码版本控制、合并代码等操作。通过 Git，您可以追踪每个文件的每个版本，并轻松地在不同版本之间进行切换和比较。Git 还提供了分支管理功能，使得可以同时进行多个并行开发任务。

*  访问 Git 官方网站：[https://git-scm.com/](https://git-scm.com/)

*  下载最新版本的 Git 安装程序。

*  运行下载的安装程序，按照安装向导的提示进行安装。

*  安装完成后，你可以通过命令行使用 `git version` 命令确认安装成功。

```
HM4G2J09L6:~ xuanhun$ git version
**git version 2.39.2 (Apple Git-143)**

```
## 2.2 安装开发工具（推荐VSCode）

VisActor 整体上属于前端技术栈，能进行前端开发的工具很多，我们推荐使用VScode。当然，你也可以使用你喜欢的开发工具。

如果你对VSCode 不是很熟悉的话，建议阅读官方文档：https://vscode.js.cn/docs/setup/setup-overview

## 2.3 安装 豆包 Marscode AI编程助手

[Marscode AI编程助手](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)

豆包 MarsCode 编程助手是豆包旗下的 AI 编程助手，提供以智能代码补全为代表的 AI 功能。它支持主流的编程语言和 IDE，在开发过程中提供单行代码或整个函数的编写建议。此外，它还支持代码解释、单测生成和问题修复等功能，提高了开发效率和质量。 更多信息，请参考[豆包 MarsCode 编程助手的文档](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DLaKb4PysoADAZx0x1RcYjXbnBe.gif' alt='' width='760' height='auto'>

借助Marscode，VisActor 开发者可以更方便的进行代码理解、文档撰写、功能开发、单元测试等多项任务。在详细的各项任务贡献指南中，会有更详细的案例说明。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BQeib7E2gonoOaxLPqjcRtAYngh.gif' alt='' width='1000' height='auto'>



## 2.4  Clone 代码到本地

进入 VChart 文件夹，添加 VChart 的远程地址

```
git remote add upstream https://github.com/VisActor/VChart.git

```
获取 VChart 最新源码

```
git pull upstream develop

```
# 初始化项目

首先，全局安装 [<u>@microsoft/rush</u>](https://rushjs.io/pages/intro/get_started/)

```
$ npm i --global @microsoft/rush

```
接下来执行命令查看demo

```
# 安装依赖
$ rush update
# 启动 vchart 的demo页
$ rush start
# 启动 react-vchart 的demo页
$ rush react
# 启动本地文档站点
$ rush docs

```
# 下一步

到目前为止，你已经做好了开发代码的准备了。接下来请继续阅读下一节教程，开始不同类型的任务。





github ：[github.com/VisActor](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2FVisActor)

VisActor 微信订阅号留言（可以通过订阅号菜单加入微信群）：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KLjmbz9TtoGzPIxarv7cmhpgnSY.gif' alt='' width='258' height='auto'>

VisActor 官网：[www.visactor.io/](https://link.juejin.cn/?target=https%3A%2F%2Fwww.visactor.io%2Fvtable)

飞书群：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Cv9xb0zzLoUWyaxMVgccWuGPn7d.gif' alt='' width='264' height='auto'>

discord：https://discord.com/invite/3wPyxVyH6m


# 本文档由由以下人员贡献

[玄魂](https://github.com/xuanhun)