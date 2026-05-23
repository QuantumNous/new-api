# Claude Code

> 来源：https://raw.githubusercontent.com/QuantumNous/new-api-docs-v1/main/content/docs/zh/apps/claude-code.mdx
> 抓取时间：2026-05-23T07:43:21.476Z
> 源文件：content/docs/zh/apps/claude-code.mdx

## 页面大纲

  - 效果演示
    - 特性
  - AI 模型配置方法
    - Windows 端图文指引
      - 1.安装 Node.js 环境
      - 2.安装 Git Bash
      - 3.安装 Claude Code
      - 4.设置环境变量
      - 5.开始使用 Claude Code
    - MacOS 端图文指引
      - 1.安装 Claude Code CLI
      - 2.设置环境变量
      - 3.开始使用 Claude Code
      - 4.macOS 常见问题解决
    - Linux 端图文指引
      - 1.安装 Claude Code
      - 2.设置环境变量
      - 3.开始使用 Claude Code
      - 4.Linux 常见问题解决

## 原文内容

---
title: Claude Code
description: Claude Code 教程 — 将 Anthropic 的终端编程助手对接 New API。支持代码理解、多文件编辑，集成 VS Code 与 JetBrains IDE。
---
<Callout type="info" title="项目介绍">
  直接在你的终端中释放 Claude
  的强大能力。瞬间搜索百万行代码库。将耗时数小时的工作流程化为一条命令。你的工具，你的工作流，你的代码库，以思维速度进化。

  - 官方主页：[https://www.anthropic.com/claude-code](https://www.anthropic.com/claude-code)
</Callout>

## 效果演示

![introduce-01.webp](../assets/claude_code/introduce-01.webp)

![introduce-02.webp](../assets/claude_code/introduce-02.webp)

### 特性

| **功能分类**       | **特性**                                                       |
| ------------------ | -------------------------------------------------------------- |
| **代码理解**       | 深度代码库分析，利用智能代理搜索理解项目结构和依赖             |
|                    | 自动生成高层次代码概述，快速帮助用户理解代码库               |
| **代码编辑**       | 支持多文件协同编辑，适用于复杂代码修改                       |
|                    | 提供符合项目模式和架构的实际可用代码建议                     |
| **集成能力**       | 支持在终端中直接运行，无需切换上下文                         |
|                    | 与VS Code和JetBrains IDE无缝集成，无需复制粘贴               |
| **代码生成和优化** | 自动生成代码、创建测试、修复错误，支持从概念到提交的完整流程 |
|                    | 为代码生成和理解优化，结合Claude Opus 4等先进模型            |
| **安全与灵活性**   | 改动需获得用户明确授权，文件和命令操作更安全                 |
|                    | 适应用户代码规范，支持自定义配置                             |
| **工具链整合**     | 支持与GitHub、GitLab等工具结合，实现自动化工作流程           |
|                    | 与测试套件、构建系统集成，增强现有开发工具                   |
| **跨平台与扩展**   | 支持Windows、macOS、Linux操作系统                            |
|                    | 可配置运行在SDK或GitHub Actions中，灵活适配不同需求          |
| **主要应用场景**   | 代码库入门和理解、新成员快速上手                             |
|                    | 代码问题修复与优化流程，从分析问题到提交PR                   |
|                    | 项目代码重构与新功能实现                                     |
| **用户反馈亮点**   | 提升日常开发效率，省去例行任务消耗的时间                     |
|                    | 处理复杂多步骤任务表现优异，扩展开发可能性                   |

## AI 模型配置方法

### Windows 端图文指引

#### 1.安装 Node.js 环境

Claude Code 需要 Node.js 环境才能运行。

<Callout type="info" title="Node.js 环境安装步骤">
  - 打开浏览器访问 https://nodejs.org/
  - 点击 "LTS"版本进行下载（推荐长期支持版本）
  - 下载完成后双击 .msi 文件
  - 按照安装向导完成安装，保持默认设置即可
</Callout>

<Callout type="warn" title="Windows 注意事项">
  - 建议使用 PowerShell 而不是 CMD
  - 如果遇到权限问题，尝试以管理员身份运行
  - 某些杀毒软件可能会误报，需要添加白名单
</Callout>

![windows-img-01.webp](../assets/claude_code/windows-img-01.webp)

![windows-img-02.webp](../assets/claude_code/windows-img-02.webp)

![windows-img-03.webp](../assets/claude_code/windows-img-03.webp)

![windows-img-04.webp](../assets/claude_code/windows-img-04.webp)

![windows-img-05.webp](../assets/claude_code/windows-img-05.webp)

<Callout type="info" title="验证安装是否成功">
  安装完成后，打开 PowerShell 或 CMD，输入以下命令：

  ```bash
  node --version
  npm --version
  ```

  如果显示版本号，说明安装成功。
</Callout>

#### 2.安装 Git Bash

<Callout type="warn" title="Windows 注意事项">
  Windows 环境下需要使用 Git Bash 安装 Claude code。安装完成后，环境变量设置和使用 Claude Code 仍然在普通的 PowerShell 或 CMD 中进行。
</Callout>

<Callout type="info" title="下载并安装 Git for Windows">
  - 访问 https://git-scm.com/downloads/win
  - 点击 "Download for Windows" 下载安装包
  - 运行下载的 .exe 安装文件
  - 在安装过程中保持默认设置，直接点击 "Next" 完成安装
</Callout>

![windows-img-06.webp](../assets/claude_code/windows-img-06.webp)

![windows-img-07.webp](../assets/claude_code/windows-img-07.webp)

![windows-img-08.webp](../assets/claude_code/windows-img-08.webp)

<Callout type="info" title="验证 Git Bash 安装">
  安装完成后，打开 Git Bash，输入以下命令验证：

  ```bash
  git --version
  ```

  如果显示版本号，说明安装成功。
</Callout>

#### 3.安装 Claude Code

<Callout type="info" title="安装 Claude Code">
  打开 PowerShell，运行以下命令：

  ```bash
  npm install -g @anthropic-ai/claude-code
  ```

  这个命令会从 npm 官方仓库下载并安装最新版本的 Claude Code。
</Callout>

![windows-img-09.webp](../assets/claude_code/windows-img-09.webp)

<Callout type="info" title="将 ~/.local/bin 加入 PATH（仅当提示要求时）">
  ```powershell
  [Environment]::SetEnvironmentVariable('Path', ([Environment]::GetEnvironmentVariable('Path','User') + ";$HOME\.local\bin"), 'User')
  ```
</Callout>

<Callout type="info" title="验证 Claude Code 安装">
  安装完成后，输入以下命令检查是否安装成功：

  ```bash
  claude --version
  ```

  如果显示版本号，恭喜你！Claude Code 已经成功安装了。
</Callout>

#### 4.设置环境变量

<Callout type="info" title="一键设置命令 (Windows 系统)">
  为了让 Claude Code 连接到你的中转服务，需要设置多个环境变量：
</Callout>

```powershell
iex (irm 'https://raw.githubusercontent.com/QuantumNous/new-api-docs/refs/heads/main/helper/claude-cli-setup.ps1')
```

![windows-configure](../assets/claude_code/windows_configure.png)

#### 5.开始使用 Claude Code

现在你可以开始使用 Claude Code 了！

<Callout type="info" title="启动 Claude Code">
  打开 PowerShell，直接启动 Claude Code：

  ```bash
  claude
  ```

  在特定项目中使用：

  ```bash
  # 进入你的项目目录
  cd C:\path\to\your\project

  # 启动 Claude Code
  claude
  ```
</Callout>

![windows-img-11.webp](../assets/claude_code/windows-img-11.webp)

![windows-img-12.webp](../assets/claude_code/windows-img-12.webp)

![windows-img-13.webp](../assets/claude_code/windows-img-13.webp)

![windows-img-14.webp](../assets/claude_code/windows-img-14.webp)

![windows-img-15.webp](../assets/claude_code/windows-img-15.webp)

<Callout type="info" title="选择模型">
  输入命令：

  ```bash
  /model
  ```

  按 Enter 进入，选择模型，通常使用默认设置即可。
</Callout>

![windows-img-16.webp](../assets/claude_code/windows-img-16.webp)

![windows-img-17.webp](../assets/claude_code/windows-img-17.webp)

> 注意：设置环境变量修改后，使用所有模型（包括官方预设模型）均调用自定义接入点，而不使用官方账号额度。

### MacOS 端图文指引

#### 1.安装 Claude Code CLI

打开终端

![macos-img-01.webp](../assets/claude_code/macos-img-01.webp)

<Callout type="info" title="安装 Claude Code">
  打开终端，运行以下命令：

  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```

  可选项：出现提示后运行提供的命令

  ```bash
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
  ```
</Callout>

![macos-img-02.webp](../assets/claude_code/macos-img-02.webp)

#### 2.设置环境变量

为了让 Claude Code 连接到第三方中转服务，需要设置环境变量：

<Callout type="info" title="一键设置 Claude Code 环境变量">
  输入命令：

  ```bash
  curl -fsSL https://raw.githubusercontent.com/QuantumNous/new-api-docs/refs/heads/main/helper/claude-cli-setup.sh | bash
  ```
</Callout>

![macos-configure](../assets/claude_code/macos_configure.png)

<Callout type="info" title="验证 Claude Code 安装">
  安装完成后，输入以下命令检查是否安装成功：

  ```bash
  claude --version
  ```

  如果显示版本号，恭喜你！Claude Code 已经成功安装了。
</Callout>

#### 3.开始使用 Claude Code

现在你可以开始使用 Claude Code 了！

<Callout type="info" title="启动 Claude Code">
  直接启动 Claude Code：

  ```bash
  claude
  ```

  在特定项目中使用：

  ```bash
  # 进入你的项目目录
  cd /path/to/your/project

  # 启动 Claude Code
  claude
  ```
</Callout>

![macos-img-04.webp](../assets/claude_code/macos-img-04.webp)

![macos-img-05.webp](../assets/claude_code/macos-img-05.webp)

![macos-img-06.webp](../assets/claude_code/macos-img-06.webp)

![macos-img-07.webp](../assets/claude_code/macos-img-07.webp)

![macos-img-08.webp](../assets/claude_code/macos-img-08.webp)

<Callout type="info" title="选择模型 (可选)">
  输入命令：

  ```bash
  /model
  ```

  按 Enter 进入，选择官方模型，通常使用默认模型即可。
</Callout>

![macos-img-09.webp](../assets/claude_code/macos-img-09.webp)

![macos-img-10.webp](../assets/claude_code/macos-img-10.webp)

![macos-img-11.webp](../assets/claude_code/macos-img-11.webp)

> 注意：设置环境变量修改 `ANTHROPIC_BASE_URL` 后，使用所有模型（包括官方预设模型）均调用自定义接入点，而不使用官方账号额度。

#### 4.macOS 常见问题解决

<Callout type="info" title="macOS 安全设置阻止运行">
  如果系统阻止运行 Claude Code：

  - 打开"系统偏好设置" → "安全性与隐私"
  - 点击"仍要打开"或"允许"
  - 或者在 Terminal 中运行：`sudo spctl --master-disable`
</Callout>

### Linux 端图文指引

#### 1.安装 Claude Code

![linux-img-01.webp](../assets/claude_code/linux-img-01.webp)

<Callout type="info" title="安装 Claude Code">
  打开终端，运行以下命令：

  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```

  如果遇到权限问题，可以使用 sudo：

  ```bash
  sudo curl -fsSL https://claude.ai/install.sh | bash
  ```
</Callout>

![linux-img-03.webp](../assets/claude_code/linux-img-03.webp)

<Callout type="info" title="验证 Claude Code 安装">
  安装完成后，输入以下命令检查是否安装成功：

  ```bash
  claude --version
  ```

  如果显示版本号，恭喜你！Claude Code 已经成功安装了。
</Callout>

#### 2.设置环境变量

为了让 Claude Code 连接到你的中转服务，需要设置两个环境变量：

<Callout type="info" title="一键修改环境变量">
  输入命令：

  ```bash
  curl -fsSL https://raw.githubusercontent.com/QuantumNous/new-api-docs/refs/heads/main/helper/claude-cli-setup.sh | bash
  ```
</Callout>

![macos-configure](../assets/claude_code/macos_configure.png)

#### 3.开始使用 Claude Code

现在你可以开始使用 Claude Code 了！

<Callout type="info" title="启动 Claude Code">
  直接启动 Claude Code：

  ```bash
  claude
  ```

  在特定项目中使用：

  ```bash
  # 进入你的项目目录
  cd /path/to/your/project

  # 启动 Claude Code
  claude
  ```
</Callout>

![linux-img-03.webp](../assets/claude_code/linux-img-03.webp)

![linux-img-04.webp](../assets/claude_code/linux-img-04.webp)

![linux-img-05.webp](../assets/claude_code/linux-img-05.webp)

<Callout type="info" title="选择模型">
  输入命令：

  ```bash
  /model
  ```

  按 Enter 进入，选择官方模型，通常使用默认模型即可。
</Callout>

![linux-img-06.webp](../assets/claude_code/linux-img-06.webp)

![linux-img-07.webp](../assets/claude_code/linux-img-07.webp)

![linux-img-08.webp](../assets/claude_code/linux-img-08.webp)

![linux-img-09.webp](../assets/claude_code/linux-img-09.webp)

> 注意：设置环境变量修改 `ANTHROPIC_BASE_URL` 后，使用所有模型（包括官方预设模型）均调用自定义接入点，而不使用官方账号额度。

#### 4.Linux 常见问题解决

<Callout type="info" title="缺少依赖库">
  某些 Linux 发行版需要安装额外依赖：

  ```bash
  # Ubuntu/Debian
  sudo apt install build-essential

  # CentOS/RHEL
  sudo dnf groupinstall "Development Tools"
  ```
</Callout>

<Callout type="info" title="环境变量不生效">
  检查以下几点：

  - 确认修改了正确的配置文件（`.bashrc` 或 `.zshrc`）
  - 重新启动终端或运行 `source ~/.bashrc`
  - 验证设置：`echo $ANTHROPIC_BASE_URL`
</Callout>
