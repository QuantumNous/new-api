---
title: 5.如何贡献代码

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

## 搜索 issue

可以通过如下方式搜索 bug 或者 feature 相关的issue：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TPy4bTm01o9MSgxiwZvcTz66nug.gif' alt='' width='487' height='auto'>

## 创建代码相关 issue

点击 “NEW ISSUE”，打开issue 选择页面，选择“**Bug Report” 或者 “Feature Request”。**

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AhNvbxd1uoZZMHxuKxscjErrnDe.gif' alt='' width='611' height='auto'>

填写你要提交的文档 issue 相关信息,并打上合适的标签即可。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Odonb0WssownV3xTSQDcEudhnOi.gif' alt='' width='828' height='auto'>

# 认领issue

如果你想贡献代码，可以在该issue下留言认领。管理员会联系你，确认后将issue assign 给你。

例如：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/MMCpb9MvEomle4xYIe1cauFUnCe.gif' alt='' width='988' height='auto'>



# 编写代码

VChart 源码在项目的中的位置如下：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/NWpDbeBSxotFA9xf7GrcM6tUntb.gif' alt='' width='952' height='auto'>

VChart 生态所有的组件都在同一目录下，按包名进行拆分，开发者需要在自己的代码分支上开发代码，然后进行提交。 

# 借助豆包 Marscode AI编程助手 进行代码编写

借助豆包[Marscode AI编程助手](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)，可以在代码编写的整个流程中提供全方面的帮助。

如果你还没有安装[Marscode AI编程助手](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)，请从该链接进入下载页面：https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a



在代码编写中，合理使用 context 指令，可以提升内容的准确性。

`**⭐️ #Workspace**`

选择 Workspace 中的全局代码作为上下文，AI 将根据用户 Query 自动寻找相关代码 Context

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DWoabR7kIoqRe8xVu7RcqjjenFg.gif' alt='' width='1000' height='auto'>

`**⭐️ #Files**`

搜索选择代码仓库中的文件作为上下文

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VcWsbki1MohwabxGtRPcZnXXnGb.gif' alt='' width='1000' height='auto'>

`**⭐️ #Code**`

搜索选择代码仓库中的函数、类作为上下文

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FDTHbZ2Hko9WrSx2JqWcJRRnnUf.gif' alt='' width='1000' height='auto'>



下面举例说明，如何使用[Marscode AI编程助手](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) 进行代码编写。

## 5.1 快速熟悉整个仓库

这里 **通过 # 唤起 #Workspace ，**然后进行提问，希望它帮忙生成一份项目结构说明文档。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VuVub5lyZoVHQqxL3T9cvojUnVu.gif' alt='' width='1000' height='auto'>

我们仍然可以针对子文件夹，进行进一步的提问。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AdgDb1oGFoAyaRxkW8xciziInvf.gif' alt='' width='1000' height='auto'>

## 5.2 解释代码

### 5.2.1  生成代码说明

当我们在文件中选择一段代码，可以从悬浮菜单中选择 Explain 命令，[Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) 会为我们生成详细的代码解释。我们可以在此基础上，进行校对和改编。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/K2RVbq5broy4rpxSStYcA4J7ndf.gif' alt='' width='1000' height='auto'>

也可以直接在对话框中输入Explain 命令。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TH9ybov7JomacGxBX2QcccwFnvc.gif' alt='' width='1000' height='auto'>

这里也可以直接使用上面提到的 #Code  context 来结合Explain 和你的指令来进行更细节的任务。

### 5.2.2 生成针对整个文件的说明

Explain 可以和 Context 或者 Files 命令搭配使用，用来生成针对整个文件的说明文档。



<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HyeabsSvjoHYZ9xAbLRc55j8nDg.gif' alt='' width='1000' height='auto'>



## 5.3 内容检索

通常我们的每个问答，[Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)  都会给出参考文档，这些文档可以给我们提供更多参考上下文，供进一步分析。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OeF0bP4jPoUZWGxqDqScyHzhnvf.gif' alt='' width='1000' height='auto'>



也可以直接进行文件检索：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/SFvjbKHzOokvkPxFGH0cZKRanpc.gif' alt='' width='1000' height='auto'>

## 5.4 代码生成

在日常编码中经常会碰到使用重复代码的场景，有时候可能并不知道某个功能是否有现成的函数已实现，此时用 `#Workspace` 来进行提问。例如：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JpG9b7ggroUfX7xduo6cd3qXnOg.gif' alt='' width='1000' height='auto'>

## 5.5 添加注释

使用 "/doc"命令生成代码注释。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KAS2bRAVWo1K5ixXvfDceiZinEh.gif' alt='' width='1000' height='auto'>



## 5.6 生成单测

VChart 单元测试代码在每个 package 的 “__**tests__” ** 目录下。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DHbGbulZ5onHbtx3KFscOLgXnFg.gif' alt='' width='1000' height='auto'>

使用 [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) “/test” 指令可以快速的生成单测代码。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OnTDbxBAzoQ9h7xEk6vcpYjAnNd.gif' alt='' width='1000' height='auto'>



## 5.7 智能提示

编写过程中，智能生成可选代码是编程助手的标配功能，大家自行体验吧。



# 提交代码

文档完成之后，先把代码push到你的远程分支。例如：

```
git commit -a -m "docs: add custom funnel demo and related docs" 

```


VisActor 的 commit 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 规范，**demo  使用docs**

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

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/H0J8bpv2qoodVCxPfFTcRHL1nCf.gif' alt='' width='1000' height='auto'>

或通过 `contribute` 按钮创建：

按照模板填写本次提交的修改内容：

*  勾选这是什么类型的修改

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AgIOb5bRAo7UUVxS52AcNZCanad.gif' alt='' width='692' height='auto'>

*  填写关联的 issue

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VGonbJeFJoc68XxDzkOc7j8Lnjd.gif' alt='' width='470' height='auto'>

*  若有复杂变更，请说明背景和解决方案

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/HYy2bLtuCopGfxxdeKkc2pt0n4e.gif' alt='' width='1000' height='auto'>

相关信息填写完成后，点击 Create pull request 提交。

管理员会review pr 决定是否通过，如果不通过需要进行修改然后重新提交。

# 下一步

接下来你可以阅读每一个模块的实现原理及源码详解，也可以加入贡献这些文档。

请加入VisActor 大家庭，贡献你的力量吧！



github ：[github.com/VisActor](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2FVisActor)

VisActor 微信订阅号（可以通过订阅号菜单加入微信群）：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ZqQ2bVj6woabSXxeLKOce9rrn9d.gif' alt='' width='258' height='auto'>

VisActor 官网：[www.visactor.io/](https://link.juejin.cn/?target=https%3A%2F%2Fwww.visactor.io%2Fvtable)

飞书群：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/F0GRbKlLOoHUwRx9JBVcKxk0n6g.gif' alt='' width='264' height='auto'>

discord：https://discord.com/invite/3wPyxVyH6m


# 本文档由由以下人员贡献

[玄魂](https://github.com/xuanhun)

# 本文档由由以下人员贡献

[玄魂](https://github.com/xuanhun)