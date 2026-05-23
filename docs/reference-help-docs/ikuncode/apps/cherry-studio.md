# CherryStudio 配置指南

> 来源：https://docs.ikuncode.cc/zh/apps/cherry-studio
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- CherryStudio 配置指南
  - ✨ 功能特点
  - 🛠️ 安装步骤
    - 第一步：下载安装 CherryStudio
    - 第二步：获取 IkunCode API Key
  - 🔧 配置 Claude 模型
    - 第一步：进入设置页面
    - 第二步：选择 Claude 模型类型
    - 第三步：配置 Claude API
  - 🔧 配置 Gemini 模型
    - 第一步：选择 Gemini 模型类型
    - 第二步：配置 Gemini API
  - 💬 开始使用
    - 创建新对话
    - 切换模型
    - 调整参数
  - 🎯 最佳实践
    - 1. 合理选择模型
    - 2. 管理 API 使用
    - 3. 优化对话体验
  - 🔍 与其他客户端的对比
  - 常见问题
    - 提示 API Key 无效？
    - 模型列表为空？
    - 对话响应速度慢？
    - 如何同时使用多个模型？
    - 更多问题
  - ✅ 完成

## 原文内容

# CherryStudio 配置指南

**全能的 AI 助手桌面客户端**

> **官方网站**：[https://www.cherry-ai.com/](https://www.cherry-ai.com/)**下载地址**：[https://www.cherry-ai.com/download](https://www.cherry-ai.com/download)

📋 简介

CherryStudio 是一款功能强大的 AI 助手桌面应用，支持多种主流 AI 模型（Claude、Gemini、GPT 等），为开发者和用户提供统一的 AI 交互界面。本教程将指导你如何配置 CherryStudio 接入 IkunCode 平台。

## ✨ 功能特点

CherryStudio 提供以下强大功能：

-   ✅ **多模型支持**：支持 Claude、Gemini、GPT 等主流 AI 模型
-   ✅ **统一界面**：一个应用管理所有 AI 服务
-   ✅ **自定义 API**：支持接入自定义 API 提供商
-   ✅ **跨平台**：支持 Windows、macOS、Linux
-   ✅ **本地优先**：数据存储在本地，保护隐私
-   ✅ **丰富功能**：对话管理、模型切换、参数调整等

## 🛠️ 安装步骤

### 第一步：下载安装 CherryStudio

1.  访问 [CherryStudio 下载页面](https://www.cherry-ai.com/download)

2.  根据你的操作系统选择对应的安装包：

    -   **Windows**：下载 `.exe` 安装程序
    -   **macOS**：下载 `.dmg` 镜像文件
    -   **Linux**：下载 `.AppImage` 或 `.deb` 包
3.  下载完成后，按照系统提示完成安装


💡 macOS 用户注意

如果提示"无法打开，因为它来自身份不明的开发者"，请在系统偏好设置 → 安全性与隐私中允许打开。

### 第二步：获取 IkunCode API Key

在配置 CherryStudio 之前，需要先从 IkunCode 平台获取 API Key：

1.  访问 [IkunCode 控制台](https://api.ikuncode.cc/console/token)
2.  登录你的账户
3.  根据需要创建对应的令牌组：
    -   **Claude 模型**：选择 只允许逆向分组
    -   **Gemini 模型**：选择 gemini分组

![只允许逆向分组](https://docs.ikuncode.cc/images/%E9%80%86%E5%90%91%E5%88%86%E7%BB%84.png)

4.  保存生成的 API Key

📋 配置快速参考

| 模型 | 提供商类型 | API 地址 | 令牌组 |
| --- | --- | --- | --- |
| Claude | `Anthropic` | `https://api.ikuncode.cc/v1/messages` | 只允许逆向分组 |
| Gemini | `Gemini` | `https://api.ikuncode.cc/v1beta/models` | gemini分组 |

## 🔧 配置 Claude 模型

### 第一步：进入设置页面

1.  打开 CherryStudio 应用
2.  点击左下角的「设置」或「偏好设置」
3.  选择「模型配置」或「API 配置」选项

### 第二步：选择 Claude 模型类型

![Claude 类型选择](https://docs.ikuncode.cc/images/apps/CherryStudio/claudeleixing.png)

在模型列表中选择你需要的 Claude 模型

### 第三步：配置 Claude API

在 Claude 配置界面中填写以下信息：

![Claude 配置界面](https://docs.ikuncode.cc/images/apps/CherryStudio/claude.png)

**配置参数**：

-   **提供商类型**：选择 `Anthropic`
-   **API 地址**：`https://api.ikuncode.cc`
-   **API Key**：粘贴你从 [IkunCode 控制台](https://api.ikuncode.cc/console/token) 获取的 Claude API Key
-   **模型名称**：输入上一步选择的模型名称（如 `claude-sonnet-4-6`）

## 🔧 配置 Gemini 模型

### 第一步：选择 Gemini 模型类型

![Gemini 类型选择](https://docs.ikuncode.cc/images/apps/CherryStudio/geminileixing.png)

在模型列表中选择你需要的 Gemini 模型：

-   **Gemini 3 Flash Preview**：`gemini-3-flash-preview` - 最新版本，速度快，性能优秀（推荐）
-   **Gemini 3 Pro Preview**：`gemini-3-pro-preview` - 高性能，适合复杂任务
-   **Gemini 2.0 Flash**：快速响应，适合简单对话

⚠️ 注意

-   Gemini 和 Claude 需要使用不同的 API Key（不同的令牌组）
-   确保你在 IkunCode 平台创建了对应的令牌组

### 第二步：配置 Gemini API

在 Gemini 配置界面中填写以下信息：

![Gemini 配置界面](https://docs.ikuncode.cc/images/apps/CherryStudio/gemini.png)

**配置参数**：

-   **提供商类型**：选择 `Gemini`
-   **API 地址**：`https://api.ikuncode.cc/v1beta/models`
-   **API Key**：粘贴你从 [IkunCode 控制台](https://api.ikuncode.cc/console/token) 获取的 Gemini API Key
-   **模型名称**：输入上一步选择的模型名称（如 `gemini-3-flash-preview`）

## 💬 开始使用

### 创建新对话

1.  点击「新建对话」或「New Chat」按钮
2.  在模型选择器中选择已配置的模型
3.  开始与 AI 对话

### 切换模型

在对话过程中，你可以随时切换不同的模型：

1.  点击顶部的模型选择器
2.  选择其他已配置的模型
3.  继续对话（上下文可能会保留或重置，取决于应用设置）

### 调整参数

CherryStudio 通常支持调整以下参数：

-   **Temperature**（温度）：控制回复的随机性（0-1）
-   **Max Tokens**（最大令牌数）：控制回复长度
-   **Top P**：控制采样范围

💡 参数建议

-   编程任务：Temperature 0.2-0.5（更准确）
-   创意写作：Temperature 0.7-0.9（更有创意）
-   日常对话：Temperature 0.5-0.7（平衡）

## 🎯 最佳实践

### 1\. 合理选择模型

不同任务使用不同模型：

-   **代码编写**：Claude Sonnet 4.5（`claude-sonnet-4-5-20250929`）
-   **快速对话**：Gemini 3 Flash Preview（`gemini-3-flash-preview`）
-   **复杂推理**：Claude Opus 4.5（`claude-opus-4-5-20251101`）
-   **多模态任务**：Gemini 3 Pro Preview（支持图片）

### 2\. 管理 API 使用

-   定期检查 [IkunCode 控制台](https://api.ikuncode.cc/console/token) 的余额
-   为不同用途创建不同的 API Key
-   避免在公共场合泄露 API Key

### 3\. 优化对话体验

-   使用清晰的提示词
-   合理设置上下文长度
-   善用对话历史管理功能

## 🔍 与其他客户端的对比

| 特性 | CherryStudio | Alma | Hapi |
| --- | --- | --- | --- |
| 界面类型 | 桌面应用 | 桌面应用 | Web/PWA |
| 多模型支持 | ✅ | ✅ | ✅ |
| 代码编辑 | 部分支持 | ✅ | ✅ |
| 终端集成 | ❌ | ✅ | ✅ |
| 远程访问 | ❌ | ❌ | ✅ |
| 学习曲线 | 低 | 中 | 中 |

**选择建议**：

-   **纯对话需求**：CherryStudio（界面简洁，易上手）
-   **编程开发**：Alma 或 Hapi（功能更强大）
-   **远程控制**：Hapi（独有功能）

## 常见问题

### 提示 API Key 无效？

**可能原因**：

-   API Key 输入错误
-   令牌组选择错误（只允许逆向分组的 Key 不能用于 Gemini）
-   余额不足

**解决方法**：

1.  检查 API Key 是否完整复制
2.  确认在 [IkunCode 控制台](https://api.ikuncode.cc/console/token) 创建了正确的令牌组（Claude 用 只允许逆向分组，Gemini 用 gemini分组）
3.  查看账户余额是否充足

### 模型列表为空？

**可能原因**：

-   Base URL 配置错误
-   网络连接问题
-   API Key 权限不足

**解决方法**：

1.  确认 Claude 的 API 地址为 `https://api.ikuncode.cc/v1/messages`
2.  确认 Gemini 的 API 地址为 `https://api.ikuncode.cc/v1beta/models`
3.  检查网络连接
4.  重新获取 API Key 并确保令牌组权限正确

### 对话响应速度慢？

**可能原因**：

-   网络延迟
-   选择的模型较大
-   上下文过长

**解决方法**：

1.  检查网络连接质量
2.  尝试使用更快的模型（如 Gemini Flash）
3.  清理或减少对话历史

### 如何同时使用多个模型？

在 CherryStudio 中：

1.  分别配置不同的模型提供商
2.  在新建对话时选择对应的模型
3.  可以创建多个对话窗口，每个使用不同模型

### 更多问题

请查看：

-   [IkunCode 控制台](https://api.ikuncode.cc/console/token)
-   [IkunCode FAQ](https://docs.ikuncode.cc/support/faq)
-   [售后支持](https://docs.ikuncode.cc/support/after-sales)
-   [CherryStudio 官方文档](https://www.cherry-ai.com/)

## ✅ 完成

🎉 **配置完成！现在你可以使用 CherryStudio 愉快地与 AI 对话了！**

记住以下要点：

-   ✅ 不同模型使用不同的 API Key（不同令牌组）
-   ✅ Claude API 地址：`https://api.ikuncode.cc/v1/messages`
-   ✅ Gemini API 地址：`https://api.ikuncode.cc/v1beta/models`
-   ✅ 根据任务选择合适的模型
-   ✅ 定期检查 [IkunCode 控制台](https://api.ikuncode.cc/console/token) 的余额
-   ✅ 妥善保管你的 API Key

* * *

**相关教程**：

-   [Alma 客户端配置](https://docs.ikuncode.cc/apps/alma)
-   [Hapi 远程控制](https://docs.ikuncode.cc/apps/hapi)
-   [IkunCode 控制台](https://api.ikuncode.cc/console/token)
