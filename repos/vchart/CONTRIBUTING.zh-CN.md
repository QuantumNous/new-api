首先为你选择加入开源贡献行列的行为点赞 👍🏻。再者，十分感谢你选择参与到 VisActor 社区，为这个开源项目做出贡献。

## VChart 贡献指南

VisActor 团队通常在 github 上进行开发和 issue 维护，请打开 [Github 网站](https://github.com/)，点击右上角 `Sign up` 按钮，注册一个自己的账号，开启你开源之旅的第一步。

如果因为特殊情况，你无法打开 Github 站点，请告知我们并通过 [Gitee](https://gitee.com/VisActor/VChart) 进行项目开发。

在 [VChart 仓库](https://github.com/VisActor/VChart)中，我们有一份面向所有开源贡献者的[指南](https://github.com/VisActor/VChart/blob/develop/CONTRIBUTING.zh-CN.md)，介绍了有关版本管理、分支管理等内容，**请花几分钟时间阅读了解一下**。

## 你的第一个 Pull Request

### Step0：安装 Git

Git 是一种版本控制系统，用于跟踪和管理软件开发项目中的代码变更。它帮助开发者记录和管理代码的历史记录，方便团队协作、代码版本控制、合并代码等操作。通过 Git，您可以追踪每个文件的每个版本，并轻松地在不同版本之间进行切换和比较。Git 还提供了分支管理功能，使得可以同时进行多个并行开发任务。

- 访问 Git 官方网站：<https://git-scm.com/>
- 下载最新版本的 Git 安装程序。
- 运行下载的安装程序，按照安装向导的提示进行安装。
- 安装完成后，你可以通过命令行使用 `git version` 命令确认安装成功。

### Step1：Fork 项目

- 首先需要 fork 这个项目，进入[VChart 项目页面](https://github.com/VisActor/VChart)，点击右上角的 Fork 按钮

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/contribution-guide/fork.PNG)

- 你的 github 帐号中会出现 xxxx(你的 github 用户名)/vchart 这个项目
- 在本地电脑上使用以下命令: 得到一个 VChart 文件夹

```
// ssh
git clone git@github.com:xxxx(你的github用户名)/VChart.git
// https
git clone https://github.com/xxxx(你的github用户名)/VChart.git
```

### Step2：获取项目代码

- 进入 VChart 文件夹，添加 VChart 的远程地址

```
git remote add upstream https://github.com/VisActor/VChart.git
```

- 获取 VChart 最新源码

```
git pull upstream develop
```

### Step3：创建分支

- 好了，现在可以开始贡献我们的代码了。VChart 默认分支为 develop 分支。无论是功能开发、bug 修复、文档编写，都请新建立一个分支，再合并到 develop 分支上。使用以下代码创建分支：

```
// 创建功能开发分支
git checkout -b feat/xxxx

// 创建问题修复开发分支
git checkout -b fix/xxxx

// 创建文档、demo分支
git checkout -b docs/add-funnel-demo
```

假设我们创建了文档修改分支 `docs/add-funnel-demo`

- 现在我们可以在分支上更改代码了
- 假设我们已经添加了一些代码，提交到代码库
- git commit -a -m "docs: add custom funnel demo and related docs" 。VisActor 的 commit 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 规范

  - `<type>[optional scope]: <description>`
  - 其中常用的`type`包括 docs（文档、日志修改）、feat（新功能）、fix（问题修复）、refactor（代码重构）等，请根据实际情况选择。
  - 请用简短精确的英文描述编写 description
  - 提交 commit 之前，我们会进行 commit lint 检查，具体可以查看[检查规则](https://github.com/VisActor/VChart/blob/98711490e90532d896dd9e44dd00a3af5b95f06d/common/autoinstallers/lint/commitlint.config.js)

### Step4：合并修改

- 一个常见的问题是远程的 upstream (@visactor/vchart) 有了新的更新， 从而会导致我们提交的 Pull Request 时会导致冲突。 因此我们可以在提交前先把远程其他开发者的 commit 和我们的 commit 合并。使用以下代码切换到 develop 分支:

```
git checkout develop
```

- 使用以下代码拉出远程的最新代码:

```
git pull upstream develop
```

- 切换回自己的开发分支:

```
git checkout docs/add-funnel-demo
```

- 把 develop 的 commit 合并到自己分支：

```
git rebase develop
```

- 把更新代码提交到自己的分支中:

```
git push origin docs/add-funnel-demo
```

### Step5：提交 Pull Request

你可以在你的 github 代码仓库页面点击 `Compare & pull request` 按钮。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/contribution-guide/create-PR.png)

或通过 `contribute` 按钮创建：

<div align='center'>
<img style="width:200px" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/contribution-guide/create-PR-2.png">
</div>

按照模板填写本次提交的修改内容：

- 勾选这是什么类型的修改
<div align='center'>
<img style="width:200px" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/contribution-guide/issue-checklist.png">
</div>

- 填写关联的 issue

<div align='center'>
<img style="width:200px" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/contribution-guide/related-issue.png">
</div>

- 若有复杂变更，请说明背景和解决方案

<div align='center'>
<img style="height:120px" src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VChart/contribution-guide/issue-background.png">
</div>

相关信息填写完成后，点击 Create pull request 提交。

## **轻松步入 VChart 开源贡献之旅**

"**good first issue**" 是一个在开源社区常见的标签，这个标签的目的是帮助新贡献者找到适合入门的问题。

VChart 的入门问题，你可以通过 [issue 列表](https://github.com/VisActor/VChart/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) 查看，目前包括两类：

- Demo 案例制作
- 简单功能开发

如果你当前**有时间和意愿**参与到社区贡献，可以在 issue 里看一看 **good first issue**，选择一个感兴趣、适合自己的认领。

相信你一定是一个有始有终的同学，所以，当你了解并决定认领一个 issue 后，请在 issue 下留言告知大家。

### Demo Task 开发指南

我们准备了一些在实际应用场景中常见的案例，需要思考如何利用 VChart 的能力实现。

你可以通过这类任务，上手对 VChart 的使用。VChart 提供了丰富的能力，每个人或许都有不同的实现思路，**你可以在 issue 下留言，和大家讨论自己的方案**。

任务完成后，你可以将自己制作的案例提交到官网 demo，让更多需要的人学习和使用。

所有的 demo 存放在 `docs/assets/examples` 目录下

1. 请基于 develop 分支，新拉一个 `docs/***` 或 `demo/***` 分支进行开发
2. （如果你已经安装，请跳过此步骤）全局安装 [@microsoft/rush](https://rushjs.io/pages/intro/get_started/)：`npm i --global @microsoft/rush`
3. 根目录下运行 `rush update`
4. 运行 `rush docs` 在本地预览目前 demo 内容
5. `docs` 目录下:
   1. `docs/assets/examples/menu.json` 目录文件中添加你的 demo 信息
   2. 在 `zh`/`en` 目录下分别完成中英文 demo 文档
   3. 在 `docs/public/vchart/preview` 目录下添加 demo 预览图片并将路径更新在 demo 文档中，例如 `/vchart/preview/basic-map_1.9.1.png`
6. 提交所有代码，并在 Github 创建 Pull Request，邀请其他人进行 review

### Feature Task 开发指南

我们准备了一些简单、易上手的特性开发任务，如果你有一定的 Javascript / Typescript 基础，可以认领这类任务。

你可以通过需求开发，更快地了解 VChart 代码架构。**你可以在 issue 下留言，和大家讨论自己的方案**。

1.  请基于 develop 分支，新拉一个 `feat/***`分支进行开发
2.  （如果你已经安装，请跳过此步骤）全局安装 [@microsoft/rush](https://rushjs.io/pages/intro/get_started/)：`npm i --global @microsoft/rush`
3.  根目录下运行 `rush update`
4.  `rush start` 在本地运行 VChart 代码的测试页面
    - 你可以在`develop/packages/vchart/__tests__/runtime/browser`下创建 index.page.local 页面，引入自己创建的开发用例
5.  确认所有的测试都是通过的 `rush test`
6.  开发完成后，运行 `rush change` 命令，编写 changelog 并提交
7.  提交所有代码，并在 Github 创建 Pull Request，邀请其他人进行 review

### 推广任务贡献指南

推广任务是指你将和 VisActor 相关的文章、demo、视频 等素材，公开发布到各种媒体渠道的行为。
你可以新建一个 issue，类型选择 `others` 打上 `promotion` 的标签，然后将相关链接，截图，简介等一起发布即可。
例如：[https://github.com/VisActor/VChart/issues/2858](https://github.com/VisActor/VChart/issues/2858)

每个季度我们会评选一些推广 VisActor 的作品，给予作者一定的物质奖励。

## 拥抱 VisActor 社区

在你为 VisActor 贡献代码之余，我们鼓励你参与其他让社区更加繁荣的事情，比如：

1. 为项目的发展、功能规划 等提建议。
2. 创作文章、视频，开办讲座来宣传 VisActor。
3. 撰写推广计划，同团队一同执行。

VisActor 也在努力帮助参与社区建设的同学一同成长，我们计划（但不限于，期待大家更多的建议）提供如下帮助：

1. 以 VisActor 为基础的数据可视化研发培训，帮助参与的同学在编程技能、可视化理论、架构设计等多个方面快速成长。
2. 定期评选“代码贡献奖”和“社区推广奖”。
3. 组织社区成员参与开源活动。

## 常见问题

### node-canvas 安装失败

vchart 的一个 monorepo 项目，当在 node 端运行 vchart 的时候，我们会依赖 [node-canvas](https://github.com/Automattic/node-canvas) 这个库，所以在执行`rush update`的时候，会需要安装`node-canvas` 这个包，但是这个包可能会在不同的操作系统下出现安装失败问题，可以参考[node-canvas](https://github.com/Automattic/node-canvas) readme 中的安装一下依赖，各个操作系统的安装方式如下：

| OS      | Command                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| macOS   | Using [Homebrew](https://brew.sh/): `brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman python-setuptools` |
| Ubuntu  | `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`                      |
| Fedora  | `sudo yum install gcc-c++ cairo-devel pango-devel libjpeg-turbo-devel giflib-devel`                                           |
| Solaris | `pkgin install cairo pango pkg-config xproto renderproto kbproto xextproto`                                                   |
| OpenBSD | `doas pkg_add cairo pango png jpeg giflib`                                                                                    |
| Windows | See the [wiki](https://github.com/Automattic/node-canvas/wiki/Installation:-Windows)                                          |
| Others  | See the [wiki](https://github.com/Automattic/node-canvas/wiki)                                                                |

如果遇到其他 node-canvas 相关问题，也可以在[node-canvas issue 列表](https://github.com/Automattic/node-canvas/issues) 中进行搜索
