# 客制化开发指南 — new-api

> 本文档面向需要对 new-api 项目进行二次开发的开发者，涵盖本地环境搭建、登录页面修改、导航页面修改、Docker 构建全流程。

---

## 目录

1. [项目结构总览](#1-项目结构总览)
2. [本地开发环境搭建](#2-本地开发环境搭建)
3. [登录页面客制化](#3-登录页面客制化)
4. [顶部导航栏客制化](#4-顶部导航栏客制化)
5. [侧边栏菜单客制化](#5-侧边栏菜单客制化)
6. [Logo 与系统名称修改](#6-logo-与系统名称修改)
7. [Docker 构建与部署](#7-docker-构建与部署)
8. [常见问题](#8-常见问题)

---

## 1. 项目结构总览

```
new-api/
├── main.go                        # Go 后端入口
├── Dockerfile                     # Docker 多阶段构建文件
├── docker-compose.yml             # Docker Compose 配置
├── web/                           # React 前端
│   ├── package.json
│   ├── bun.lock
│   └── src/
│       ├── App.jsx                # 路由配置
│       ├── index.jsx              # 前端入口
│       ├── components/
│       │   ├── auth/              # 登录/注册/密码重置组件
│       │   │   ├── LoginForm.jsx          ← 登录页面主体
│       │   │   ├── RegisterForm.jsx       ← 注册页面
│       │   │   └── PasswordResetForm.jsx  ← 密码重置
│       │   └── layout/            # 布局组件
│       │       ├── headerbar/             ← 顶部导航栏
│       │       │   ├── index.jsx          ← 导航栏容器
│       │       │   ├── Navigation.jsx     ← 顶部导航链接
│       │       │   ├── HeaderLogo.jsx     ← Logo + 系统名
│       │       │   ├── ActionButtons.jsx  ← 右侧按钮区
│       │       │   ├── UserArea.jsx       ← 用户头像/下拉菜单
│       │       │   ├── ThemeToggle.jsx    ← 主题切换按钮
│       │       │   └── LanguageSelector.jsx ← 语言选择器
│       │       ├── SiderBar.jsx           ← 左侧菜单栏
│       │       ├── PageLayout.jsx         ← 整体页面框架
│       │       └── Footer.jsx             ← 页脚
│       ├── hooks/common/
│       │   ├── useNavigation.js   ← 顶部导航链接数据
│       │   └── useSidebar.js      ← 侧边栏菜单数据与权限
│       └── pages/                 # 各页面
│           ├── Home/index.jsx     ← 首页
│           └── ...
├── controller/                    # Go 控制器层
├── service/                       # Go 业务逻辑层
├── model/                         # Go 数据模型层
└── relay/                         # AI 接口代理层
```

---

## 2. 本地开发环境搭建

### 前置要求

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| Go | 1.22+ | 后端语言 |
| Bun | 最新版 | 前端包管理器（**不要用 npm/yarn**） |
| Docker | 20+ | 构建镜像用 |
| Git | 任意 | 版本管理 |

### 安装 Bun（Windows）

```powershell
# PowerShell 中执行
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 启动后端

```powershell
# 在项目根目录
go mod download          # 首次下载依赖
go run main.go           # 启动后端，监听 :3000
```

### 启动前端（热更新开发模式）

```powershell
# 进入 web 目录
cd web
bun install              # 安装依赖（首次）
bun run dev              # 启动前端开发服务器（默认 :5173）
```

> **说明**：前端开发服务器会自动将 `/api` 请求代理到后端 `localhost:3000`，两者需同时运行。

### 访问地址

- 前端开发页面：`http://localhost:5173`
- 后端 API：`http://localhost:3000`

---

## 3. 登录页面客制化

### 核心文件

```
web/src/components/auth/LoginForm.jsx   （约 984 行）
```

### 3.1 修改登录页标题和 Logo

登录页的 Logo 和标题来自系统配置（后台可设置），代码中读取方式：

```jsx
// LoginForm.jsx 第 116-117 行
const logo = getLogo();           // 从 localStorage 读取 Logo URL
const systemName = getSystemName(); // 从 localStorage 读取系统名称
```

**修改方式一（推荐）**：在后台「系统设置」中修改 Logo URL 和系统名称，无需改代码。

**修改方式二（硬编码）**：直接替换变量值：

```jsx
// 找到第 116-117 行，改为：
const logo = '/your-logo.png';      // 放在 web/public/ 目录下
const systemName = '你的系统名称';
```

### 3.2 登录页面布局结构

登录页有两种模式，由 `showEmailLogin` 状态控制：

| 状态 | 渲染函数 | 说明 |
|------|----------|------|
| `showEmailLogin = false` | `renderMainLoginView()` | 主登录视图（OAuth 按钮 + 邮箱入口） |
| `showEmailLogin = true` | `renderEmailLoginForm()` | 邮箱/密码登录表单（约第 719 行） |

### 3.3 修改登录表单样式

登录表单使用 **Semi Design UI** 组件 + **Tailwind CSS** 类名。

**修改卡片圆角**（找到 `renderEmailLoginForm` 函数）：

```jsx
// 原来
<Card className='border-0 !rounded-2xl overflow-hidden'>

// 改为更大圆角
<Card className='border-0 !rounded-3xl overflow-hidden shadow-lg'>
```

**修改背景色**（找到最外层 div）：

```jsx
// 原来（白色背景）
<div className='min-h-screen flex items-center justify-center bg-gray-50'>

// 改为渐变背景
<div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100'>
```

### 3.4 隐藏/显示 OAuth 登录按钮

OAuth 按钮（GitHub、Discord、微信等）由后台配置控制，代码中通过 `status` 对象判断：

```jsx
// LoginForm.jsx 中的判断逻辑
{status.github_oauth && (
  <Button onClick={onGitHubOAuthClicked}>使用 GitHub 继续</Button>
)}
{status.discord_oauth && (
  <Button onClick={onDiscordOAuthClicked}>使用 Discord 继续</Button>
)}
```

**关闭方式**：在后台「系统设置 → OAuth」中关闭对应选项，无需改代码。

**强制隐藏（代码层面）**：将对应的 `{status.xxx && ...}` 整段删除即可。

### 3.5 修改登录按钮文字

```jsx
// 找到提交按钮，通常是：
<Button onClick={handleLogin} loading={loginLoading}>
  {t('登录')}  ← 修改这里的翻译 key，或直接改为固定文字
</Button>
```

---

## 4. 顶部导航栏客制化

### 核心文件

```
web/src/components/layout/headerbar/index.jsx       # 导航栏容器
web/src/components/layout/headerbar/Navigation.jsx  # 导航链接渲染
web/src/hooks/common/useNavigation.js               # 导航链接数据
```

### 4.1 修改顶部导航链接

导航链接在 `useNavigation.js` 中定义：

```javascript
// web/src/hooks/common/useNavigation.js

const allLinks = [
  {
    text: t('首页'),       // 显示文字（支持 i18n）
    itemKey: 'home',       // 唯一标识
    to: '/',               // 路由路径
  },
  {
    text: t('控制台'),
    itemKey: 'console',
    to: '/console',
  },
  {
    text: t('模型广场'),
    itemKey: 'pricing',
    to: '/pricing',
  },
  // 文档链接（外部链接）
  {
    text: t('文档'),
    itemKey: 'docs',
    isExternal: true,
    externalLink: docsLink,   // 后台配置的文档链接
  },
  {
    text: t('关于'),
    itemKey: 'about',
    to: '/about',
  },
];
```

**新增一个导航链接**：

```javascript
// 在 allLinks 数组中添加：
{
  text: '帮助中心',
  itemKey: 'help',
  isExternal: true,
  externalLink: 'https://your-help-site.com',
},
```

同时在过滤逻辑中添加（`allLinks.filter` 之前）：

```javascript
// 在 filter 回调中添加对新 itemKey 的处理
return modules[link.itemKey] === true || link.itemKey === 'help';
```

**删除某个导航链接**：直接从 `allLinks` 数组中删除对应对象即可。

### 4.2 修改导航栏背景色

```jsx
// web/src/components/layout/headerbar/index.jsx 第 68 行
<header className='text-semi-color-text-0 sticky top-0 z-50 transition-colors duration-300 bg-white/75 dark:bg-zinc-900/75 backdrop-blur-lg'>

// 改为纯白无模糊：
<header className='text-semi-color-text-0 sticky top-0 z-50 bg-white dark:bg-zinc-900 border-b border-gray-200'>

// 改为自定义颜色：
<header className='text-semi-color-text-0 sticky top-0 z-50 bg-blue-600 text-white'>
```

### 4.3 修改导航链接样式

```jsx
// web/src/components/layout/headerbar/Navigation.jsx 第 33-37 行
const baseClasses = 'flex-shrink-0 flex items-center gap-1 font-semibold rounded-md transition-all duration-200 ease-in-out';
const hoverClasses = 'hover:text-semi-color-primary';
const spacingClasses = isMobile ? 'p-1' : 'p-2';

// 改为带下划线悬停效果：
const hoverClasses = 'hover:text-blue-600 hover:underline';
```

### 4.4 控制导航链接的显示/隐藏

顶部导航模块的显示由后台「系统设置 → 导航模块」控制，对应 `HeaderNavModules` 配置项。

格式示例（JSON）：

```json
{
  "home": true,
  "console": true,
  "pricing": true,
  "docs": false,
  "about": false
}
```

将某项设为 `false` 即可在导航栏中隐藏该链接，**无需改代码**。

---

## 5. 侧边栏菜单客制化

### 核心文件

```
web/src/components/layout/SiderBar.jsx   （约 533 行）
web/src/hooks/common/useSidebar.js       （菜单权限控制）
```

### 5.1 菜单分组结构

侧边栏分为 4 个分组：

| 分组变量 | 分组名 | 包含菜单项 |
|----------|--------|------------|
| `chatMenuItems` | 聊天区 | 操练场、聊天 |
| `workspaceItems` | 工作区 | 数据看板、令牌管理、使用日志、绘图日志、任务日志 |
| `financeItems` | 个人区 | 钱包管理、个人设置 |
| `adminItems` | 管理区 | 渠道管理、订阅管理、模型管理、模型部署、兑换码管理、用户管理、系统设置 |

### 5.2 修改菜单项文字

```jsx
// SiderBar.jsx 中找到对应菜单项，修改 text 字段：
{
  text: t('令牌管理'),   // ← 修改这里，或直接写固定文字
  itemKey: 'token',
  to: '/token',
},
```

### 5.3 新增菜单项

以在「工作区」新增一个「API 文档」菜单为例：

```jsx
// SiderBar.jsx，在 workspaceItems 的 items 数组中添加：
{
  text: 'API 文档',
  itemKey: 'apidoc',
  to: '/console/apidoc',   // 需要在 App.jsx 中添加对应路由
},
```

同时在 `routerMap` 对象（第 33 行）中添加路由映射：

```javascript
const routerMap = {
  // ...已有路由...
  apidoc: '/console/apidoc',   // 新增
};
```

### 5.4 删除菜单项

直接从对应分组的 `items` 数组中删除该对象即可。

### 5.5 通过后台配置控制菜单显示

侧边栏菜单同样支持后台配置控制，对应 `SidebarModules` 配置项。

默认配置（`useSidebar.js` 中的 `DEFAULT_ADMIN_CONFIG`）：

```json
{
  "chat": { "enabled": true, "playground": true, "chat": true },
  "console": { "enabled": true, "detail": true, "token": true, "log": true, "midjourney": true, "task": true },
  "personal": { "enabled": true, "topup": true, "personal": true },
  "admin": { "enabled": true, "channel": true, "models": true, "deployment": true, "redemption": true, "user": true, "subscription": true, "setting": true }
}
```

将某项设为 `false` 即可隐藏对应菜单，**无需改代码**。

---

## 6. Logo 与系统名称修改

### 方式一：通过后台设置（推荐）

1. 登录管理员账号
2. 进入「系统设置 → 通用设置」
3. 修改「系统名称」和「Logo URL」
4. 保存后立即生效，无需重新构建

### 方式二：修改默认值（代码层面）

Logo 和系统名称的默认值在 `helpers` 工具函数中：

```javascript
// web/src/helpers/index.js 或 helpers 目录中
export function getLogo() {
  return localStorage.getItem('logo') || '/logo.png';  // ← 修改默认 Logo
}

export function getSystemName() {
  return localStorage.getItem('system_name') || 'New API';  // ← 修改默认名称
}
```

### 替换默认 Logo 文件

将你的 Logo 图片放到 `web/public/` 目录，命名为 `logo.png`（或其他名称，对应修改 `getLogo()` 返回值）。

---

## 7. Docker 构建与部署

### 7.1 Dockerfile 构建流程说明

`Dockerfile` 采用三阶段构建：

```
阶段 1 (builder)     oven/bun:1
  └─ bun install + bun run build
  └─ 输出：web/dist/（前端静态文件）

阶段 2 (builder2)    golang:1.26.1-alpine
  └─ go mod download
  └─ go build（嵌入前端 dist）
  └─ 输出：./new-api（单一可执行文件）

阶段 3 (runtime)     debian:bookworm-slim
  └─ 仅复制 new-api 二进制
  └─ 最终镜像体积最小
```

### 7.2 构建命令

```powershell
# 在项目根目录执行

# 基础构建
docker build -t new-api:latest .

# 带版本标签构建
docker build -t new-api:v1.0.0 .

# 指定平台构建（Linux 服务器部署用）
docker build --platform linux/amd64 -t new-api:latest .

# 多平台构建（需要 buildx，适合同时支持 x86 和 ARM 服务器）
docker buildx build --platform linux/amd64,linux/arm64 -t new-api:latest --push .
```

### 7.3 本地运行测试

```powershell
# 基础运行（SQLite 数据库）
docker run -d `
  -p 3000:3000 `
  -v ${PWD}/data:/data `
  --name new-api `
  new-api:latest

# 访问：http://localhost:3000
```

### 7.4 使用 docker-compose 部署

项目自带 `docker-compose.yml`，支持 MySQL + Redis：

```powershell
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f new-api

# 停止服务
docker-compose down
```

### 7.5 完整客制化后的构建流程

```
1. 修改前端文件（web/src/...）
         ↓
2. 本地验证（bun run dev）
         ↓
3. 检查构建是否报错（bun run build）
         ↓
4. 构建 Docker 镜像（docker build）
         ↓
5. 本地测试镜像（docker run）
         ↓
6. 推送到镜像仓库（docker push）
         ↓
7. 服务器拉取并重启（docker pull + docker-compose up -d）
```

### 7.6 加速构建技巧

**使用国内镜像加速（Go 依赖）**：

在 `Dockerfile` 的 `builder2` 阶段添加：

```dockerfile
ENV GOPROXY=https://goproxy.cn,direct
```

**使用 BuildKit 缓存**：

```powershell
$env:DOCKER_BUILDKIT=1
docker build -t new-api:latest .
```

---

## 8. 常见问题

### Q1: 前端修改后不生效？

- 确认修改的是 `web/src/` 下的文件，而不是 `web/dist/`（dist 是构建产物，会被覆盖）
- 开发模式下浏览器强制刷新：`Ctrl + Shift + R`

### Q2: Docker 构建失败，提示 bun install 错误？

- 检查 `web/bun.lock` 文件是否存在且未损坏
- 尝试本地先执行 `cd web && bun install` 确认依赖可正常安装

### Q3: 修改了导航菜单但没有显示？

- 检查后台「系统设置」中的 `HeaderNavModules` 配置，确认对应 `itemKey` 为 `true`
- 检查 `useNavigation.js` 中的 `filter` 逻辑是否过滤掉了新增的链接

### Q4: 侧边栏某些菜单对普通用户不显示？

- 管理员菜单（`adminItems`）通过 `isAdmin()` 和 `isRoot()` 函数控制权限
- 普通用户登录后不会看到渠道管理、用户管理等管理员菜单，这是正常行为

### Q5: 如何修改页脚内容？

```
web/src/components/layout/Footer.jsx
```

直接编辑该文件中的 JSX 内容即可。

### Q6: 如何修改网页标题（浏览器 Tab 标题）？

标题在 `PageLayout.jsx` 中动态设置：

```javascript
// PageLayout.jsx 第 107-109 行
let systemName = getSystemName();
if (systemName) {
  document.title = systemName;   // ← 修改为固定标题或自定义逻辑
}
```

也可以直接修改 `web/index.html` 中的 `<title>` 标签作为默认值。

---

## 附录：常用开发命令速查

```powershell
# 后端
go run main.go                    # 启动后端
go build -o new-api.exe .         # 本地编译

# 前端
cd web
bun install                       # 安装依赖
bun run dev                       # 开发服务器
bun run build                     # 生产构建
bun run i18n:extract              # 提取 i18n 翻译 key
bun run i18n:sync                 # 同步翻译文件

# Docker
docker build -t new-api:latest .                    # 构建镜像
docker run -d -p 3000:3000 -v ./data:/data new-api  # 运行容器
docker-compose up -d                                # Compose 启动
docker-compose logs -f new-api                      # 查看日志
docker-compose down                                 # 停止并删除容器
```

---

*文档版本：2026-04-05 | 基于 new-api develop 分支*
