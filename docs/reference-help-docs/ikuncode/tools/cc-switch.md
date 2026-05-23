# CC-Switch 快速配置工具

> 来源：https://docs.ikuncode.cc/zh/tools/cc-switch
>
> 抓取时间：2026-05-23T07:09:46.142Z

## 页面大纲

- CC-Switch 快速配置工具
  - 🔗 相关链接
  - 🎯 工具介绍
  - 📦 安装方法
    - 🖥️ Windows 平台
    - 🍏 macOS 平台
    - 🐧 Linux 平台
  - 🚀 快速开始
    - 第一步：初始化设置
    - 第二步：添加提供商配置
    - 第三步：切换提供商
    - 第四步：应用配置
  - 📖 完整文档
  - 🔗 项目资源

## 原文内容

# CC-Switch 快速配置工具

**All-in-One AI CLI 管理器 - 桌面应用程序**

## 🔗 相关链接

| 资源 | 地址 |
| --- | --- |
| GitHub 发布页 | [cc-switch/releases](https://github.com/farion1231/cc-switch/releases) |
| CC-Switch 文档站 | [ccswitch.lovable.app](https://ccswitch.lovable.app/) |

## 🎯 工具介绍

CC-Switch 是一款跨平台桌面应用程序，统一管理 Claude Code、Codex 和 Gemini CLI 三大 AI 编程工具。通过直观的图形界面，实现配置切换、MCP 服务器管理、系统提示和 Claude Skills 管理。

💡 核心功能

• 一键切换不同 AI 工具的提供商配置 • API 端点速度测试与质量指示器 • 多预设系统提示管理 • MCP 服务器统一架构管理 • Claude Skills 发现与安装系统 • 配置备份/恢复（自动保留最近10个） • 深度链接协议支持（`ccswitch://`） • 环境变量冲突检测

![CC-Switch 软件界面](https://docs.ikuncode.cc/images/tu6.png)

## 📦 安装方法

### 🖥️ Windows 平台

#### 方法一：MSI 安装器（推荐）

1.  访问项目发布页：[https://github.com/farion1231/cc-switch/releases](https://github.com/farion1231/cc-switch/releases)
2.  下载最新版本的 `.msi` 安装器
3.  运行安装器，按照向导完成安装
4.  安装完成后从开始菜单启动 CC-Switch

#### 方法二：便携版（无需安装）

1.  下载 `.zip` 便携版压缩包
2.  解压到任意目录
3.  运行 `cc-switch.exe` 即可使用

### 🍏 macOS 平台

#### 推荐方式：Homebrew 安装

bash

```
# 添加 tap 源
brew tap farion1231/ccswitch

# 安装 cc-switch
brew install --cask cc-switch
```

#### 手动安装

1.  访问 [Releases 页面](https://github.com/farion1231/cc-switch/releases)
2.  下载 `.dmg` 安装包
3.  打开 DMG 文件，将 CC-Switch 拖入应用程序文件夹
4.  从启动台或应用程序文件夹启动

### 🐧 Linux 平台

#### Debian/Ubuntu 系列（推荐）

bash

```
sudo dpkg -i cc-switch_*.deb
sudo apt-get install -f  # 修复依赖
```

#### AppImage 通用版本

bash

```
chmod +x cc-switch_*.AppImage
./cc-switch_*.AppImage
```

#### Arch Linux（AUR）

bash

```
paru -S cc-switch-bin
# 或使用 yay
yay -S cc-switch-bin
```

## 🚀 快速开始

### 第一步：初始化设置

打开 CC-Switch，进入「设置」页面，在「通用」标签下将「窗口行为」中的所有开关全部打开，确保自启动、Claude Code 插件集成、托盘最小化等功能正常生效。

![CC-Switch 初始化设置界面](https://docs.ikuncode.cc/images/cc-switch-init-settings.png)

💡 推荐配置

建议将「窗口行为」中的所有开关全部启用，以获得最佳使用体验：开机自启、静默启动、应用到 Claude Code 插件、跳过初次安装确认、关闭时最小化到托盘。

### 第二步：添加提供商配置

1.  点击右上角的加号按钮来添加提供商(Claude/Gemini)

    ![添加新供应商配置界面](https://docs.ikuncode.cc/images/cc-switch-add-provider.png)

    💡 Gemini 用户

    如果使用的是 Gemini CLI，请在平台创建**对应的**令牌，而非 Claude 分组。

2.  点击右上角的加号按钮来添加提供商(Codex)

    ![添加新供应商配置界面](https://docs.ikuncode.cc/images/cc-switch-add-provider2.png)

3.  点击「保存」完成配置


⚠️ 重要提示

不同的AI工具（Claude Code、Codex、Gemini CLI）需要不同的令牌组配置。 请在[监测站](https://status.ikuncode.cc/)中选择合适的分组创建令牌。

### 第三步：切换提供商

1.  在提供商列表中选择要使用的配置
2.  点击「启用」按钮
3.  **或**使用系统托盘图标进行即时切换

**系统托盘快速切换：**

-   右键点击系统托盘中的 CC-Switch 图标
-   从菜单中直接选择要切换的提供商
-   配置立即生效（Claude Code支持热重载，其它的可能需要重新启动）

### 第四步：应用配置

切换配置后，关闭并重新启动对应的 AI 工具即可自动应用新配置。

## 📖 完整文档

更多详细配置和高级功能，请参阅 [CC-Switch 官方完整文档](https://www.ccswitch.io/zh/docs?section=getting-started)。

## 🔗 项目资源

-   **GitHub 仓库**：[https://github.com/farion1231/cc-switch](https://github.com/farion1231/cc-switch)
-   **问题反馈**：[GitHub Issues](https://github.com/farion1231/cc-switch/issues)
-   **最新版本**：[Releases 页面](https://github.com/farion1231/cc-switch/releases)

🎉 开始使用！

现在您可以使用 CC-Switch 轻松管理多个 AI 编程工具的配置了。 享受高效的开发体验！
