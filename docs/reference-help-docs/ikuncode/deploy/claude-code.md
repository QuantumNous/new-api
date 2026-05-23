# Claude Code 部署指南

> 来源：https://docs.ikuncode.cc/zh/deploy/claude-code
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- Claude Code 部署指南
  - ⚡ 首次安装必读：跳过初始化报错
  - 🚀 使用 CC-Switch 快速配置（推荐）
    - CC-Switch 优势
    - 配置步骤
  - ⌨️ 手动命令行配置
    - 🖥️ Windows 平台
    - 🍏 macOS 平台
    - 🐧 Linux 平台
  - 常见问题
    - 提示找不到命令？
    - 连接失败？
    - 更多问题

## 原文内容

# Claude Code 部署指南

| 资源 | 地址 |
| --- | --- |
| 官方文档 | [docs.claude.com](https://docs.claude.com/zh-CN/docs/claude-code/overview) |

📋 前置要求

请先完成 [Node.js 环境安装](https://docs.ikuncode.cc/node/windows)，确保 Node.js 18+ 已正确安装。

## ⚡ 首次安装必读：跳过初始化报错

使用中转渠道时，Claude Code 首次启动会出现以下报错：

![Claude Code 首次启动报错](https://docs.ikuncode.cc/images/err.png)

```
Welcome to Claude Code
Unable to connect to Anthropic services
Failed to connect to api.anthropic.com: ERR_BAD_REQUEST
```

这是因为 Claude Code 首次启动会尝试连接官方 API 进行初始化确认，中转渠道无法通过此步骤。**安装完成后、首次启动前**，请先执行以下任一方法跳过：

**方法一：使用 CC-Switch 跳过（推荐）**

打开 [CC-Switch 配置工具](https://docs.ikuncode.cc/tools/cc-switch)，进入 **设置 → 通用**，开启 **「跳过 Claude Code 初次安装确认」** 选项即可。

![CC-Switch 跳过初次安装确认](https://docs.ikuncode.cc/images/docs.png)

**方法二：手动修改配置文件**

在用户主目录下找到 `~/.claude.json` 文件，在末尾添加 `"hasCompletedOnboarding": true` 字段：

⚠️ 注意 JSON 格式

添加字段前，需要在上一个字段末尾**补一个英文逗号**，否则 JSON 格式错误会导致 Claude Code 无法启动。

json

```
{
  "installMethod": "unknown",
  "autoUpdates": true,
  "firstStartTime": "2025-07-14T06:11:03.877Z",
  "userID": "xxxx",
  "projects": {
    "/home/your-user": {
      "allowedTools": [],
      "history": [],
      "mcpContextUris": [],
      "mcpServers": {},
      "enabledMcpjsonServers": [],
      "disabledMcpjsonServers": [],
      "hasTrustDialogAccepted": false,
      "projectOnboardingSeenCount": 0,
      "hasClaudeMdExternalIncludesApproved": false,
      "hasClaudeMdExternalIncludesWarningShown": false
    }
  },  // 这里要加英文逗号
  "hasCompletedOnboarding": true  // 新增此字段
}
```

修改保存后，重新运行 `claude` 即可正常使用。

> 参考来源：[Claude Code 跳过初始化确认](https://www.cnblogs.com/gordonMlxg/articles/19103691)

## 🚀 使用 CC-Switch 快速配置（推荐）

如果您已安装 [CC-Switch 快速配置工具](https://docs.ikuncode.cc/tools/cc-switch)，可以通过图形界面轻松管理 Claude Code 的配置，无需手动编辑配置文件和环境变量。

### CC-Switch 优势

-   图形化界面，操作简单直观
-   一键切换不同提供商配置
-   自动管理环境变量和配置文件
-   支持配置备份与恢复
-   无需重启终端即可切换配置

### 配置步骤

**1\. 启动 CC-Switch 并添加 Claude Code 配置**

1.  打开 CC-Switch 应用程序
2.  点击顶部的「Claude」标签页
3.  点击右上角橙色「+」按钮添加新配置

![CC-Switch 添加 Claude Code 配置界面](https://docs.ikuncode.cc/images/tu8.png)

**2\. 填写提供商配置信息**

1.  **提供商名称**：自定义名称（如"ikuncode"）
2.  **API Base URL**：输入 `https://api.ikuncode.cc`
3.  **API Key**：粘贴您从 IkunCode 平台获取的 Claude 专用令牌
4.  **模型选择**：根据需求选择可用的 Claude 模型
5.  点击「保存」按钮

![CC-Switch Claude Code 配置详细信息](https://docs.ikuncode.cc/images/tu7.png)

💡 提示

-   可以添加多个不同的提供商配置（如官方、ikuncode等）
-   CC-Switch 会自动修改 `~/.claude/settings.json` 配置文件
-   切换配置后，关闭并重启 Claude Code 即可生效

**3\. 启用配置并使用**

1.  在配置列表中找到刚创建的「ikuncode」配置
2.  点击配置右侧的「当前使用」按钮（或直接点击配置卡片）
3.  配置会被标记为「当前使用」状态（绿色标签）
4.  重启 Claude Code，新配置即可生效

**4\. 系统托盘快速切换**

CC-Switch 支持通过系统托盘快速切换配置：

-   右键点击系统托盘中的 CC-Switch 图标
-   在菜单中选择 Claude 分类
-   直接选择要切换到的配置
-   配置立即生效，无需打开主界面

⚠️ 注意事项

-   确保从 IkunCode 平台创建的是 Claude Code 专用令牌
-   切换配置后需要重启 Claude Code 才能生效
-   可以在 CC-Switch 中测试 API 端点速度，选择最优配置

## ⌨️ 手动命令行配置

如果您不使用 CC-Switch，也可以通过命令行手动配置 Claude Code。

### 🖥️ Windows 平台

#### 系统要求

Windows 10、11

#### 安装步骤

**方法一：Native Install（推荐）**

使用 PowerShell：

powershell

```
irm https://claude.ai/install.ps1 | iex
```

使用 CMD：

cmd

```
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

**方法二：NPM 安装（不推荐）**

⚠️ 不建议使用 npm 安装

npm 渠道更新滞后，安装的版本通常较旧，建议优先使用上方的 Native 方式。

powershell

```
npm install -g @anthropic-ai/claude-code
```

验证安装：

powershell

```
claude --version
```

#### 配置环境变量

如果是 PowerShell：

powershell

```
[Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "sk-xxx", "User")
[Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "https://api.ikuncode.cc", "User")
```

如果是 CMD：

cmd

```
setx ANTHROPIC_AUTH_TOKEN "sk-xxx"
setx ANTHROPIC_BASE_URL "https://api.ikuncode.cc"
```

💡 提示

请注意将 `sk-xxx` 替换为你自己的专属key！ 设置好后，重启终端以让环境变量生效。

4.  启动Claude

在终端，进入（cd 目录）到项目目录或在任意目录，输入命令 `claude` 即可启动使用。

### 🍏 macOS 平台

#### 系统要求

MacOS 10.15 (Catalina) 或更高版本

#### 安装步骤

**方法一：Homebrew（推荐）**

bash

```
brew install --cask claude-code
```

**方法二：Curl Script**

bash

```
curl -fsSL https://claude.ai/install.sh | bash
```

**方法三：NPM 安装（不推荐）**

⚠️ 不建议使用 npm 安装

npm 渠道更新滞后，安装的版本通常较旧，建议优先使用上方的 Native 方式。

bash

```
npm install -g @anthropic-ai/claude-code
```

#### 验证安装

bash

```
claude -v
```

正常情况应该输出类似于：`1.0.108 (Claude Code)`

#### 配置环境变量

bash

```
echo 'export ANTHROPIC_AUTH_TOKEN="sk-xxx"' >> ~/.bash_profile
echo 'export ANTHROPIC_BASE_URL="https://api.ikuncode.cc"' >> ~/.bash_profile
source ~/.bash_profile
```

💡 提示

请注意将 `sk-xxx` 替换为你自己的专属key！

#### 重启终端并启动Claude

重启终端后，进入（cd 目录）到项目目录或在任意目录，输入命令 `claude` 即可启动使用。

### 🐧 Linux 平台

#### 系统要求

Linux发行版 (Ubuntu 18.04+, CentOS 7+, Debian 9+等)

#### 安装步骤

**方法一：Curl Script（推荐）**

bash

```
curl -fsSL https://claude.ai/install.sh | bash
```

**方法二：NPM 安装（不推荐）**

⚠️ 不建议使用 npm 安装

npm 渠道更新滞后，安装的版本通常较旧，建议优先使用上方的 Native 方式。

bash

```
npm install -g @anthropic-ai/claude-code
```

#### 验证安装

bash

```
claude -v
```

#### 配置环境变量

**Ubuntu/Debian（Bash）**

bash

```
echo 'export ANTHROPIC_AUTH_TOKEN="sk-xxx"' >> ~/.bash_profile
echo 'export ANTHROPIC_BASE_URL="https://api.ikuncode.cc"' >> ~/.bash_profile
source ~/.bash_profile
```

**Fedora/CentOS（Zsh）**

bash

```
echo 'export ANTHROPIC_AUTH_TOKEN="sk-xxx"' >> ~/.zshrc
echo 'export ANTHROPIC_BASE_URL="https://api.ikuncode.cc"' >> ~/.zshrc
source ~/.zshrc
```

💡 提示

请注意将 `sk-xxx` 替换为你自己的专属key！

#### 重启终端并启动Claude

重启终端后，进入（cd 目录）到项目目录或在任意目录，输入命令 `claude` 即可启动使用。

## 常见问题

### 提示找不到命令？

-   确认 Claude Code 已正确安装
-   检查 PATH 环境变量
-   重启终端窗口

### 连接失败？

-   检查网络连接
-   确认 API Key 正确
-   检查余额是否充足

### 更多问题

请查看 [FAQ](https://docs.ikuncode.cc/support/faq) 或联系[售后支持](https://docs.ikuncode.cc/support/after-sales)。
