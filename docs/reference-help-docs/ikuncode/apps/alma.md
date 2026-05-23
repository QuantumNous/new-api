# Alma 客户端配置指南

> 来源：https://docs.ikuncode.cc/zh/apps/alma
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- Alma 客户端配置指南
  - 🔗 相关链接
  - ✨ 功能特点
  - 🛠️ 安装与配置
    - 第一步：安装 Alma
    - 第二步：设置中文界面
    - 第三步：添加 IkunCode 自定义供应商
    - 第四步：配置多个分组（可选）
  - 💬 新建聊天与使用
    - 重要设置提醒
    - 使用技巧
  - 🎯 最佳实践
    - 1. 选择合适的模型
    - 2. 合理使用上下文
    - 3. 充分利用 Alma 的集成功能
  - 常见问题
    - 如何切换不同的 API 提供商？
    - 为什么有些模型无法使用？
    - Alma 和 Claude Code 有什么区别？
    - 更多问题
  - ✅ 完成

## 原文内容

# Alma 客户端配置指南

**功能强大的 AI 编程客户端工具**

📋 简介

Alma 是一款功能强大且界面精美的 AI 客户端工具，集成了代码编写、终端操作、Git 管理、浏览器等多种功能，为开发者提供完整的 AI 辅助编程体验。

## 🔗 相关链接

| 资源 | 地址 |
| --- | --- |
| Alma 官网 | [https://alma.now/](https://alma.now/) |

## ✨ 功能特点

Alma 提供以下强大功能：

-   ✅ **代码编写**：智能代码生成和补全
-   ✅ **终端操作**：集成终端，直接执行命令
-   ✅ **Git 管理**：可视化 Git 操作
-   ✅ **浏览器集成**：内置浏览器支持
-   ✅ **多模型支持**：支持 Claude、Gemini 等多种模型
-   ✅ **自定义供应商**：可接入自定义 API 提供商

![Alma 功能展示](https://docs.ikuncode.cc/images/apps/alma/image%204.png)

## 🛠️ 安装与配置

### 第一步：安装 Alma

访问 [Alma 官网](https://alma.now/) 下载并安装适合你操作系统的版本。

### 第二步：设置中文界面

为了更好的使用体验，建议将界面设置为中文：

1.  打开 Alma 应用
2.  进入 **设置 → 通用 → 语言**
3.  选择「中文」

![设置中文界面](https://docs.ikuncode.cc/images/apps/alma/image.png)

### 第三步：添加 IkunCode 自定义供应商

**1\. 进入供应商设置**

点击 **选择供应商 → Add Custom Provider**（添加自定义提供商）

![添加供应商](https://docs.ikuncode.cc/images/apps/alma/image%201.png)

**2\. 配置 IkunCode 供应商**

填写以下信息：

-   **Provider Name**：IkunCode（或自定义名称）
-   **Base URL**：`https://api.ikuncode.cc/v1`
-   **API Key**：粘贴你从 [IkunCode 控制台](https://api.ikuncode.cc/console/token) 创建的 API Key

💡 提示

-   Claude 模型：确保使用 只允许逆向分组的 API Key
-   Gemini 模型：确保使用 gemini分组的 API Key
-   IkunCode 的 Codex 暂不支持第三方客户端调用

**3\. 获取可用模型**

添加完成后，在 IkunCode 供应商界面点击 **Fetch**（获取）按钮，系统会自动获取所有可用模型。

![Fetch 获取模型](https://docs.ikuncode.cc/images/apps/alma/image%202.png)

选择你需要的模型即可开始使用。

### 第四步：配置多个分组（可选）

IkunCode 支持通过不同的 API Key（不同分组）访问不同的模型集合。

在供应商界面，你可以：

1.  填写不同分组的 API Key
2.  获取对应分组的模型列表
3.  根据需求切换使用

![不同分组配置](https://docs.ikuncode.cc/images/apps/alma/image%205.png)

![模型选择](https://docs.ikuncode.cc/images/apps/alma/image%206.png)

💡 提示

如需使用 Gemini 3 的画图功能，需要选择 **default** 渠道的 API Key。

## 💬 新建聊天与使用

### 重要设置提醒

在新建聊天时，**上下文范围** 设置非常重要：

![上下文设置](https://docs.ikuncode.cc/images/apps/alma/image%203.png)

⚠️ 强烈建议

**选择「全选」而非「自动」！**

经测试，选择「自动」时模型会产生严重的幻觉问题，可能导致：

-   引用不存在的文件
-   生成错误的代码逻辑
-   误解项目结构

选择「全选」可以确保模型获得完整的上下文信息，提供更准确的响应。

### 使用技巧

**1\. 代码编写**

-   描述你的需求，Alma 会生成对应代码
-   支持多文件操作和项目级别的修改
-   可以实时预览和修改生成的代码

**2\. 终端操作**

-   集成终端直接执行命令
-   支持查看命令执行结果
-   可以与 AI 互动调试问题

**3\. Git 管理**

-   可视化查看 Git 状态
-   AI 辅助编写提交信息
-   支持分支管理和合并操作

**4\. 文件浏览**

-   浏览项目文件结构
-   快速定位和编辑文件
-   支持文件搜索和过滤

## 🎯 最佳实践

### 1\. 选择合适的模型

-   **Claude Sonnet**：适合日常编码任务，速度快
-   **Claude Opus**：适合复杂的架构设计和难题
-   **Gemini**：适合需要多模态能力的任务（如图片理解）

### 2\. 合理使用上下文

-   对于小型项目，可以「全选」所有文件
-   对于大型项目，选择相关的模块和文件
-   定期清理不相关的上下文，避免 token 浪费

### 3\. 充分利用 Alma 的集成功能

-   使用终端功能验证 AI 生成的代码
-   利用 Git 集成管理代码版本
-   通过浏览器功能查看文档和参考资料

## 常见问题

### 如何切换不同的 API 提供商？

在聊天界面顶部的模型选择器中，可以随时切换不同的提供商和模型。

### 为什么有些模型无法使用？

-   检查对应的 API Key 是否有权限访问该模型
-   确认账户余额是否充足
-   查看 [IkunCode 控制台](https://api.ikuncode.cc/console/token) 的令牌组设置（Claude 用 只允许逆向分组，Gemini 用 gemini分组）

### Alma 和 Claude Code 有什么区别？

| 特性 | Alma | Claude Code |
| --- | --- | --- |
| 界面 | 图形化界面 | 命令行界面 |
| 适用场景 | 全功能开发环境 | 终端快速操作 |
| 集成功能 | 终端、Git、浏览器等 | 纯命令行工具 |
| 学习曲线 | 较低 | 较高 |

可以根据具体需求选择使用。

### 更多问题

请查看 [FAQ](https://docs.ikuncode.cc/support/faq) 或联系[售后支持](https://docs.ikuncode.cc/support/after-sales)。

## ✅ 完成

🎉 **配置完成！现在你可以愉快地使用 Alma 进行 AI 辅助编程了！**

记住以下要点：

-   ✅ 选择「全选」上下文范围
-   ✅ 根据任务选择合适的模型
-   ✅ 充分利用 Alma 的集成功能
-   ✅ 定期检查 API 余额
