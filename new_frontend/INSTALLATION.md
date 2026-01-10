# 安装和启动指南

## 📦 前置要求

- Node.js >= 18.0.0
- npm >= 9.0.0

## 🚀 快速开始

### 1. 进入项目目录

```bash
cd new_frontend
```

### 2. 安装依赖

```bash
npm install
```

这将安装所有必要的依赖，包括：
- React 18.3
- Vite 5
- TypeScript 5
- shadcn-ui 相关包
- TanStack Query
- Playwright
- 等等...

### 3. 初始化 shadcn-ui

```bash
npx shadcn-ui@latest init
```

配置选项（使用默认值即可）：
- Would you like to use TypeScript? **yes**
- Which style would you like to use? **Default**
- Which color would you like to use as base color? **Slate**
- Where is your global CSS file? **src/styles/globals.css**
- Would you like to use CSS variables for colors? **yes**
- Where is your tailwind.config.js located? **tailwind.config.js**
- Configure the import alias for components: **@/components**
- Configure the import alias for utils: **@/lib/utils**
- Are you using React Server Components? **no**

### 4. 添加基础 shadcn-ui 组件

```bash
# 一次性添加所有基础组件
npx shadcn-ui@latest add button input label card dialog dropdown-menu select table toast form tabs badge avatar separator checkbox radio-group switch slider textarea alert popover tooltip progress accordion collapsible
```

或者分批添加：

```bash
# 表单组件
npx shadcn-ui@latest add button input label form checkbox radio-group switch slider textarea select

# 布局组件
npx shadcn-ui@latest add card separator tabs accordion collapsible

# 反馈组件
npx shadcn-ui@latest add dialog alert toast popover tooltip

# 数据展示
npx shadcn-ui@latest add table badge avatar progress

# 导航组件
npx shadcn-ui@latest add dropdown-menu
```

### 5. 创建环境变量文件

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置 API 地址：

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=New API
VITE_APP_VERSION=1.0.0
```

### 6. 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:5173 启动

## 🧪 运行测试

### 单元测试

```bash
# 运行测试
npm run test

# 运行测试（UI 模式）
npm run test:ui

# 生成覆盖率报告
npm run test:coverage
```

### E2E 测试

首先安装 Playwright 浏览器：

```bash
npx playwright install
```

然后运行测试：

```bash
# 运行 E2E 测试
npm run test:e2e

# 运行 E2E 测试（UI 模式）
npm run test:e2e:ui

# 调试模式
npm run test:e2e:debug
```

## 📚 运行 Storybook

```bash
npm run storybook
```

Storybook 将在 http://localhost:6006 启动

## 🔧 其他命令

### 代码检查和格式化

```bash
# ESLint 检查
npm run lint

# ESLint 修复
npm run lint:fix

# Prettier 格式化
npm run format

# TypeScript 类型检查
npm run type-check
```

### 构建生产版本

```bash
npm run build
```

构建产物将在 `dist` 目录

### 预览生产版本

```bash
npm run preview
```

## 📝 注意事项

### 关于 TypeScript 错误

在安装依赖之前，您会看到很多 TypeScript 错误（找不到模块等）。这是正常的，因为依赖还没有安装。运行 `npm install` 后，这些错误会消失。

### 关于 CSS 警告

在安装 Tailwind CSS 之前，您可能会看到 `@tailwind` 和 `@apply` 的 CSS 警告。这也是正常的，安装依赖后会消失。

### 关于 shadcn-ui 组件

shadcn-ui 不是一个 npm 包，而是通过 CLI 将组件代码复制到您的项目中。这意味着：
- 组件代码归您所有，可以自由修改
- 不需要担心版本升级问题
- 可以根据需要定制组件

## 🎯 下一步

安装完成后，您可以：

1. **查看文档**
   - `docs/SHADCN_GUIDE.md` - shadcn-ui 使用指南
   - `docs/PLAYWRIGHT_MCP.md` - Playwright 测试指南
   - `docs/COMPONENT_WORKFLOW.md` - 组件开发流程
   - `docs/API_INTEGRATION.md` - API 集成指南
   - `docs/DEPLOYMENT.md` - 部署指南

2. **开始开发**
   - 按照原子设计方法论创建组件
   - 参考 `前端重构完整计划.md` 实现页面
   - 为每个组件编写测试和文档

3. **运行示例**
   - 访问 http://localhost:5173 查看应用
   - 访问 http://localhost:6006 查看 Storybook

## ❓ 常见问题

### Q: 安装依赖时出现错误？
A: 确保 Node.js 版本 >= 18.0.0，npm 版本 >= 9.0.0

### Q: shadcn-ui init 失败？
A: 确保已经运行 `npm install` 安装了所有依赖

### Q: 端口被占用？
A: 修改 `vite.config.ts` 中的 `server.port` 配置

### Q: 如何添加更多 shadcn-ui 组件？
A: 运行 `npx shadcn-ui@latest add [component-name]`

### Q: 如何查看所有可用的 shadcn-ui 组件？
A: 运行 `npx shadcn-ui@latest add` 不带参数，会显示所有可用组件

## 📞 获取帮助

如果遇到问题，请查看：
- [shadcn-ui 官方文档](https://ui.shadcn.com)
- [Vite 文档](https://vitejs.dev)
- [React 文档](https://react.dev)
- [Playwright 文档](https://playwright.dev)

---

**祝您开发愉快！** 🎉
