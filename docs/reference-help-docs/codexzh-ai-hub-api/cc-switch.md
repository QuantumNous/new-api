# CC-Switch 使用指南

> 来源：https://docs.codexzh.com/ai-hub-api/cc-switch
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- CC-Switch 使用指南
  - CC-Switch 下载地址
  - 前置准备
  - 配置 Claude Code
    - 步骤 1：打开 CC-Switch
    - 步骤 2：选择顶部的 Claude 分组，点击右侧的 + 按钮
    - 步骤 3：选择供应商
    - 步骤 4：填写 API Key
    - 步骤 5：启用配置
    - 步骤 6：验证配置
  - 配置 Codex
    - 步骤概览
  - 配置 Gemini
    - 步骤概览
    - 快速切换
  - 常见问题
    - CC-Switch 无法启动
    - 配置后仍然无法使用
    - 提示「模型不存在」
  - 手动配置

## 原文内容

# CC-Switch 使用指南

使用 CC-Switch 一键配置 Claude Code、Codex、Gemini、opencode。

## CC-Switch 下载地址

**Mac 下载**：[https://v2li.lanzouq.com/i4PI63hm6vmh](https://v2li.lanzouq.com/i4PI63hm6vmh)

**Windows 下载**：[https://v2li.lanzouq.com/iF1tX3jm8ged](https://v2li.lanzouq.com/iF1tX3jm8ged)

> **为什么推荐 CC-Switch？**
>
> 图形化界面，无需手动编辑配置文件；一键切换不同 API 提供商；支持多个 API Key 管理；配置随时保存和切换。

## 前置准备

在开始前，请确保：

1.  已安装对应的 CLI 工具（Claude Code、Codex 或 Gemini）
2.  已在控制台创建 API 令牌
3.  已下载 CC-Switch 工具

> **还没完成？**
>
> -   [code cli 客户端下载](https://docs.codexzh.com/ai-hub-api/clients) - 下载必要工具
> -   [快速开始](https://docs.codexzh.com/ai-hub-api/quick-start) - 创建 API 令牌

## 配置 Claude Code

### 步骤 1：打开 CC-Switch

启动 CC-Switch 软件，你会看到初始界面：

![CC-Switch 初始界面](https://docs.codexzh.com/assets/5.D_h6oryd.jpg)

* * *

### 步骤 2：选择顶部的 Claude 分组，点击右侧的 + 按钮

* * *

### 步骤 3：选择供应商

在供应商列表中，找到并选择 **"ai hub api"** 分组：

![CC-Switch 初始界面](https://docs.codexzh.com/assets/6.BF5GIN5Y.jpg)

* * *

### 步骤 4：填写 API Key

1.  回到控制台，进入「令牌管理」页面
2.  找到你创建的 **CC 分组** 令牌，点击「复制」

![创建 key](https://docs.codexzh.com/assets/3.Cm5gFkwX.jpg)

3.  回到 CC-Switch，在 **"API Key"** 输入框中粘贴令牌
4.  点击右下角 **"添加"** 按钮

* * *

### 步骤 5：启用配置

添加成功后，在主界面会看到刚才配置的项目：

点击右侧的 **"启用"** 按钮，状态变为 **"使用中"**。

![启用配置](https://docs.codexzh.com/assets/8.Ch2z4lib.jpg)

* * *

### 步骤 6：验证配置

打开终端，运行：

bash

```
claude
```

发送 hi，看到对话界面并能正常回复，即表示配置成功！

* * *

## 配置 Codex

### 步骤概览

1.  在 CC-Switch 顶部分组栏选择 **"Codex"**
2.  供应商选择 **"ai-hub-api"**
3.  填写 **Codex 分组** 的 API Key
4.  点击添加并启用
5.  终端运行 `codex` 验证

> **重要提醒**
>
> Codex 必须使用 **Codex 分组** 的令牌！使用其他分组会导致模型不可用。

* * *

## 配置 Gemini

### 步骤概览

1.  在 CC-Switch 顶部分组栏选择 **"Gemini"**
2.  供应商选择 **"ai-hub-api"**
3.  填写 **gemini 分组** 的 API Key
4.  点击添加并启用
5.  终端运行 `gemini` 验证

* * *

### 快速切换

点击对应配置的「启用」按钮，即可切换到该配置。

* * *

## 常见问题

### CC-Switch 无法启动

可能原因：

-   缺少运行库（Windows）
-   权限不足（macOS）

解决方案：

-   Windows：安装 [VC++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe)
-   macOS：右键打开，选择「打开」绕过安全检查

* * *

### 配置后仍然无法使用

检查步骤：

1.  确认 CLI 工具已正确安装（运行 `claude --version` 等）
2.  确认 API Key 是对应分组的令牌
3.  确认已点击「启用」按钮
4.  重启终端或重新启动 CC-Switch

* * *

### 提示「模型不存在」

原因：令牌分组选择错误

解决：

-   使用 Claude Code → 必须使用 CC 分组令牌
-   使用 Codex → 必须使用 Codex 分组令牌

查看 [模型分组介绍](https://docs.codexzh.com/ai-hub-api/model-groups) 了解更多。

* * *

## 手动配置

如果不想使用 CC-Switch，可以手动编辑配置文件：

-   [CLI 配置教程](https://docs.codexzh.com/ai-hub-api/cli-config) - 手动配置指南

* * *

**最后更新**：2025-02-01
