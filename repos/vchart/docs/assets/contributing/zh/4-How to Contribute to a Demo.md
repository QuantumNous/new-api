---
title: 4.如何贡献demo

key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---

# 创建分支

VChart 默认分支为 develop 分支。无论是功能开发、bug 修复、文档编写，都请新建立一个分支，再合并到 develop 分支上。使用以下代码创建分支：

```
// 创建文档、demo分支
git checkout -b docs/add-funnel-demo

```

# 寻找或者创建 issue

原则上，我们规定每一个 pr 都要有对应的 issue。在开始开发之前，请确认是否有对应的 issue，且 issue 没有被认领。

## 搜索 demo issue

可以通过如下方式搜索 demo 相关的 issue：

```
 label:demos

```

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/RDQZbKyEYomaIRx7jwJccGoMnId.gif' alt='' width='769' height='auto'>

其中他有些 feature 会关联 doc 标签，可以进一步看一下该 issue 是不是纯 demo 任务。

## 创建 demo issue

点击 “NEW ISSUE”，打开 issue 选择页面，选择“**Others”。**

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VNGhbVirmoaQTIxhOlFc61w3nqb.gif' alt='' width='1000' height='auto'>

填写你要提交的文档 issue 相关信息,并打上“demos”标签即可。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Cc8SbSAFFoCvQ2xJFd6cjv17nyc.gif' alt='' width='1000' height='auto'>

# 认领 issue

如果你想提交 demo 或者修改 demo bug，可以在该 issue 下留言认领。管理员会联系你，确认后将 issue assign 给你。

例如：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Q2vGbhmevorebJxa8Toc1hmtnMc.gif' alt='' width='988' height='auto'>

# 创建或者修改 demo

VChart 文档和 demo 在项目的中的位置如下（examples）：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ObSbbLIPio1un5xZGv7cZ7m8nrh.gif' alt='' width='1000' height='auto'>

以基础面积图的示例文档为例（目前一份示例同时包含中英文版本，分别在 zh & en 的路径下）：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/ZivMbU0iwouDoIx6T3pcleJnn1b.gif' alt='' width='1000' height='auto'>

示例 Markdown 内容分为几个部分：

- 元信息：示例内容的属性定义，包括图表分类、封面图、关键词等；

- 标题：一级标题下的正文内容对应了示例的描述信息；

- 关键配置：示例中所包含的关键配置说明，这一部分将在示例页面右侧的“关键配置”中呈现；

- 代码演示：示例执行的具体代码内容，目前只支持原生的 JavaScript 代码。

其中 Markdown 的元信息的字段定义为：

- group：示例的分类信息，描述了当前示例属于什么图表类别

- title：示例的标

- keywords：示例的关键词

- order：示例在同个分组下的排序依据

- cover：示例的封面图

- tutorial：跳转的教程链接（默认的示例教程将会跳转到示例分组所对应的教程）

目前图表示例的 group 包含多个分类，例如 area chart、bar chart、combination、storytelling 等，对应到 vchart 示例画廊中全部图表下的分类。具体的分类字段可以参照已有的示例文档进行填写。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/BCvZbkvF9oiPWlx6R2zcJxxBn7e.gif' alt='' width='1000' height='auto'>

最后，在 `docs/assets/examples/menu.json` 中添加新的 demo 路径，从而可以在 `rush docs` 时预览效果，并在官网中展示。

# 借助豆包 Marscode AI 编程助手进行 demo 编写

借助豆包[Marscode AI 编程助手](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)，可以在文档创作的整个流程中提供全方面的帮助。

如果你还没有安装[Marscode AI 编程助手](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a)，请从该链接进入下载页面：https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a

在 demo 编写中，合理使用 context 指令，可以提升内容的准确性。

`**⭐️ #Workspace**`

选择 Workspace 中的全局代码作为上下文，AI 将根据用户 Query 自动寻找相关代码 Context

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/XQaqbAX59oLBKOxR7ngctRbQnXb.gif' alt='' width='1000' height='auto'>

`**⭐️ #Files**`

搜索选择代码仓库中的文件作为上下文

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/MhZTbAAD2oj1XJxil8WcHYSWn6d.gif' alt='' width='1000' height='auto'>

`**⭐️ #Code**`

搜索选择代码仓库中的函数、类作为上下文

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/V4M7bX87hoHOxOxM1Nfc9of0nhL.gif' alt='' width='1000' height='auto'>

下面举例说明，如何使用[Marscode AI 编程助手](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) 进行 demo 编写。

## 5.1 提供文档框架

这里 **通过 # 唤起 #Workspace ，**然后进行提问，选中一份 example 的文档内容，希望它仿照生成一份新的 example 文档。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TUHVbTez5o6IjtxmCLhcWnGHnZg.gif' alt='' width='1000' height='auto'>

我们可以在此基础上继续细节的调整。

## 5.2 生成说明文字

每个 demo 的说明文字可以先用 [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) 生成，然后再做校对和调整。比如：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/U6n7bEo0DoaCGyxtiVVc1GBGnrg.gif' alt='' width='1000' height='auto'>

## 5.3 生成示例代码

为了更好的解释说明原理和用法，通常需要给出可以实际运行的 demo，可以利用 [Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) 的代码生成能力为我们生成示例代码。不过目前各种 AI 的代码生成能力都不能保证准确，还需要进一步的进行验证。

## 5.4 内容检索

通常我们的每个问答，[Marscode](https://www.marscode.cn/home?utm_source=developer&utm_medium=oss&utm_campaign=visactor_a) 都会给出参考文档，这些文档可以给我们提供更多参考上下文，供进一步分析。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DGyBbfi99oucAYxxkyJcfka3nJa.gif' alt='' width='1000' height='auto'>

也可以直接进行文件检索：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WM9Ubr9JYoYAjOxFQ6tc8cW3nLd.gif' alt='' width='1000' height='auto'>

# 提交代码

文档完成之后，先把代码 push 到你的远程分支。例如：

```
git commit -a -m "docs: add custom funnel demo and related docs"

```

VisActor 的 commit 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 规范，**demo 使用 docs**

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

# 提交 PR

你可以在你的 github 代码仓库页面点击 `Compare & pull request` 按钮。

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FWm3bZjbnoaqUOxiygXcFdLznwf.gif' alt='' width='1000' height='auto'>

或通过 `contribute` 按钮创建：

按照模板填写本次提交的修改内容：

- 勾选这是什么类型的修改

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/V7xpbJhhEoSoCExC31WcyKvHnDe.gif' alt='' width='692' height='auto'>

- 填写关联的 issue

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/O6YqbpdxgodBjfxHXEpcwob4n5E.gif' alt='' width='470' height='auto'>

- 若有复杂变更，请说明背景和解决方案

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QsnYbfLCio4u3MxK2uIc8epKnXh.gif' alt='' width='1000' height='auto'>

相关信息填写完成后，点击 Create pull request 提交。

管理员会 review pr 决定是否通过，如果不通过需要进行修改然后重新提交。

# 下一步

接下来可以继续尝试不同类型的任务。

github ：[github.com/VisActor](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2FVisActor)

VisActor 微信订阅号留言（可以通过订阅号菜单加入微信群）：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/I8OdbhGfkort6oxqHW6cR492n7d.gif' alt='' width='258' height='auto'>

VisActor 官网：[www.visactor.io/](https://link.juejin.cn/?target=https%3A%2F%2Fwww.visactor.io%2Fvtable)

飞书群：

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DdEAbEU9yoFq9IxjrN4curJnnyf.gif' alt='' width='264' height='auto'>

discord：https://discord.com/invite/3wPyxVyH6m

# 本文档由由以下人员贡献

[玄魂](https://github.com/xuanhun)
