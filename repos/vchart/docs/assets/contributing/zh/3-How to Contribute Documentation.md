---
title: 3.如何贡献文档

key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# 创建分支

VChart 默认分支为 develop 分支。无论是功能开发、bug 修复、文档编写，都请新建立一个分支，再合并到 develop 分支上。使用以下代码创建分支：

```
// 创建文档、demo分支
git checkout -b docs/add-funnel-demo

```


# 寻找或者创建issue

原则上，我们规定每一个pr都要有对应的issue。在开始开发之前，请确认是否有对应的issue，且issue没有被认领。

## 搜索文档issue

可以通过如下方式搜索文档相关的issue：

```
is:open label:docs 

```


<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JkscbtGcbo9iQRxuAR2clnx6n9J.gif' alt='' width='801' height='auto'>

其中他有些 feature 会关联doc标签，可以进一步看一下该issue 是不是纯文档任务。

## 创建文档issue

点击 “NEW ISSUE”，打开issue 选择页面，选择“**Documentation Request”。**

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Xs7nbpfaCo479XxGRq5cONJ3nye.gif' alt='' width='1000' height='auto'>

填写你要提交的文档 issue 相关信息即可。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KXsCbe7XYo0puWxn3oGczfXInbc.gif' alt='' width='1000' height='auto'>

# 认领issue

如果你想撰写文档或者修改文档bug，可以在该issue下留言认领。管理员会联系你，确认后将issue assign 给你。

例如：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/V9UTb3w08oJcj6xUSUKc32gTnrh.gif' alt='' width='988' height='auto'>



# 创建或者修改文档

VChart 文档和demo在项目的中的位置如下：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DWwxbUDeZoC9Drx8gOGczzAcncc.gif' alt='' width='1000' height='auto'>

目前文档类型如下：

*  api：接口文档，对应站点 https://www.visactor.io/vchart/api/API/vchart

*  changelog：日志，对应站点：https://www.visactor.io/vchart/changelog/release

*  demos：一些可以独立运行的demo，供调试用

*  examples：图表示例，对应站点:

https://www.visactor.io/vchart/example

https://www.visactor.io/vchart/example-react

https://www.visactor.io/vchart/example-openinula

*  faq：faq 文档，对应站点：https://www.visactor.io/vchart/faq/1-%20Does%20the%20tooltip%20support%20changing%20the%20background%20color

*  guid：教程，对应站点：https://www.visactor.io/vchart/guide/tutorial_docs/VChart_Website_Guide

*  option：spec 说明，对应站点：https://www.visactor.io/vchart/option/barChart

*  themes：主题配置工具，对应站点：https://www.visactor.io/vchart/theme/playground

*  contributing：社区贡献者文档，对应站点：https://www.visactor.io/vchart/guide/contributing_docs/Contribution_Guide



找到对应的文档位置进行新增或者修改。这里需要注意的是部分文档需要同时维护 “menu.json” 文件。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TxwTb83S5oOnqMx5VI7cqzjXnkg.gif' alt='' width='528' height='auto'>

该文件对应文档最后在站点上显示的位置和名称等。例如

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/L6WpbXlFEo15F4xSIsMch9YTnof.gif' alt='' width='1000' height='auto'>

# 借助豆包 Marscode AI编程助手 进行文档写作

[Marscode AI编程助手](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)

借助豆包[Marscode AI编程助手](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)，可以在文档创作的整个流程中提供全方面的帮助。

如果你还没有安装[Marscode AI编程助手](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)，请从该链接进入下载页面：https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a



在文档写作中，合理使用 context 指令，可以提升内容的准确性。

`**⭐️ #Workspace**`

选择 Workspace 中的全局代码作为上下文，AI 将根据用户 Query 自动寻找相关代码 Context

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WiikbC26FovfN8xiDrkc5jDGn4b.gif' alt='' width='1000' height='auto'>

`**⭐️ #Files**`

搜索选择代码仓库中的文件作为上下文

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OG15bVGdAoghaux6QlUckffVnfg.gif' alt='' width='1000' height='auto'>

`**⭐️ #Code**`

搜索选择代码仓库中的函数、类作为上下文

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BEaXbdXyUoik0WxoWqHcz0A6nCg.gif' alt='' width='1000' height='auto'>





下面举例说明，如何使用[Marscode AI编程助手](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) 进行文档写作。

## 5.1 提供文档写作思路

这里 **通过 # 唤起 #Workspace ，**然后进行提问，希望它帮忙生成一份开发者文档大纲。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/GnctbsyzWo6OBFxLFFNcjXh9n22.gif' alt='' width='1000' height='auto'>

## 5.2 生成项目结构说明

这里 **通过 # 唤起 #Workspace ，**然后进行提问，希望它帮忙生成一份项目结构说明文档。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/RI9sb17ygoL2JMxwpqrcDLD3nVh.gif' alt='' width='1000' height='auto'>

我们仍然可以针对子文件夹，进行进一步的提问。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Za3MbDf4FoEnQKx5vUUcpB34nZg.gif' alt='' width='1000' height='auto'>

## 5.3 生成文件或代码详解

### 5.3.1  生成代码说明

当我们在文件中选择一段代码，可以从悬浮菜单中选择 Explain 命令，[Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) 会为我们生成详细的代码解释。我们可以在此基础上，进行校对和改编。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BQurb7A6fo7UVJxxuqHcSLIdnzc.gif' alt='' width='1000' height='auto'>

也可以直接在对话框中输入Explain 命令。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FtYLb95EEoCXGOx835tc3X2Zn7g.gif' alt='' width='1000' height='auto'>

这里也可以直接使用上面提到的 #Code  context 来结合Explain 和你的指令来进行更细节的任务。

### 5.3.2 生成针对整个文件的说明

Explain 可以和 Context 或者 Files 命令搭配使用，用来生成针对整个文件的说明文档。



<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HoqGbdBxyolQodx2uhdcquven0g.gif' alt='' width='1000' height='auto'>

## 5.4 生成示例代码

为了更好的解释说明原理和用法，通常需要给出可以实际运行的demo，可以利用 [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) 的代码生成能力为我们生成示例代码。不过目前各种AI 的代码生成能力都不能保证准确，还需要进一步的进行验证。





## 5.5 内容检索

通常我们的每个问答，[Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)  都会给出参考文档，这些文档可以给我们提供更多参考上下文，供进一步分析。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QMD7b5mQgoyNYtxNK5jcNTL4n7c.gif' alt='' width='1000' height='auto'>



也可以直接进行文件检索：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ZBPmb7fn5oK3DAxLQAxcBP1An5d.gif' alt='' width='1000' height='auto'>

## 5.6 翻译文档
VisActor 的文档需要同时提供中英文，Marscode可以辅助用来进行翻译。

# 提交代码

文档完成之后，先把代码push到你的远程分支。例如：

```
git commit -a -m "docs: add custom funnel demo and related docs" 

```


VisActor 的 commit 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 规范

`<type>[optional scope]: <description>`

其中常用的`type`包括 docs（文档、日志修改）、feat（新功能）、fix（问题修复）、refactor（代码重构）等，请根据实际情况选择。

请用简短精确的英文描述编写 description

提交 commit 之前，我们会进行 commit lint 检查，具体可以查看[检查规则](https://github.com/VisActor/VChart/blob/98711490e90532d896dd9e44dd00a3af5b95f06d/common/autoinstallers/lint/commitlint.config.js)。

一个常见的问题是远程的 upstream (@visactor/vchart) 有了新的更新， 从而会导致我们提交的 Pull Request 时会导致冲突。 因此我们可以在提交前先把远程其他开发者的 commit 和我们的 commit 合并。使用以下代码切换到 develop 分支:

```
git checkout develop

```
使用以下代码拉出远程的最新代码:

```
git pull upstream develop

```
切换回自己的开发分支:

```
git checkout docs/add-funnel-demo

```
把 develop 的 commit 合并到自己分支：

```
git rebase develop

```
把更新代码提交到自己的分支中:

```
git push origin docs/add-funnel-demo

```
# 提交PR

你可以在你的 github 代码仓库页面点击 `Compare & pull request` 按钮。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/S8hebTyczoKfg7x4ZTncy8uenX9.gif' alt='' width='1000' height='auto'>

或通过 `contribute` 按钮创建：

按照模板填写本次提交的修改内容：

*  勾选这是什么类型的修改

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/J9z9biTukokoJBx846zcIOVqnsh.gif' alt='' width='692' height='auto'>

*  填写关联的 issue

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Oxl7bkBuEoHdssxxfRHc11IAnsg.gif' alt='' width='470' height='auto'>

*  若有复杂变更，请说明背景和解决方案

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/RUeebaBA8oGMZNxWdi1cstXWn1d.gif' alt='' width='1000' height='auto'>

相关信息填写完成后，点击 Create pull request 提交。

管理员会review pr 决定是否通过，如果不通过需要进行修改然后重新提交。

# 下一步

不同的文档类型中，demo 文档有一些特殊要求，可以参考“如何贡献demo”一节。

接下来可以继续尝试不同类型的任务。





github ：[github.com/VisActor](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2FVisActor)

VisActor 微信订阅号留言（可以通过订阅号菜单加入微信群）：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Cj40bjDrxoEDnZxrBl4cEfs9nyc.gif' alt='' width='258' height='auto'>

VisActor 官网：[www.visactor.io/](https://link.juejin.cn/?target=https%3A%2F%2Fwww.visactor.io%2Fvtable)

飞书群：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VeKlb1t5sogCmExPAFmcbtmgndb.gif' alt='' width='264' height='auto'>

discord：https://discord.com/invite/3wPyxVyH6m


# 本文档由由以下人员贡献

[玄魂](https://github.com/xuanhun)