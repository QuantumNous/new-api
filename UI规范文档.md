# UI 规范文档 (UI Specification)

## 1. 概述
本着为 New API 项目提供统一、现代化且用户友好的界面，我们制定了本 UI 规范。本规范基于 **Semi Design 2.88.2** 设计系统，结合 **Tailwind CSS** 进行原子化样式管理。

## 2. 路由规范 (Routing)
所有路由路径必须遵循 **kebab-case**（短横线命名）原则，并保持清晰的层级结构。

### 2.1 命名规则
- **正确**: `/user-profile`, `/api-keys`, `/console/settings`
- **错误**: `/userProfile`, `/api_keys`, `/Console/Settings`

### 2.2 层级结构
- **公开页面**: 直接位于根路径下，如 `/login`, `/pricing`, `/about`。
- **控制台页面**: 统一在 `/console` 前缀下，如 `/console/dashboard`, `/console/models`。
- **认证流程**: 在 `/oauth` 或 `/auth` 下（当前为 `/oauth/*`）。

## 3. 设计规范 (Design System)

### 3.1 核心库
- **UI 组件库**: `@douyinfe/semi-ui` (v2.88.2)
- **图标库**: `@douyinfe/semi-icons` (v2.88.2)
- **CSS 框架**: `Tailwind CSS` (辅助布局与间距)

### 3.2 色彩体系 (Colors)
使用 Semi Design 默认色彩 Token，支持明暗模式自动切换。
- **主色 (Primary)**: Semi Blue
- **功能色**:
  - 成功: Green
  - 警告: Orange
  - 错误: Red
  - 信息: Blue

### 3.3 排版 (Typography)
- 字体家族: 优先使用系统默认字体栈，Semi Design 会自动处理。
- 字号:
  - 标题: `h1`~`h6` (使用 Semi Typography 组件)
  - 正文: 14px (默认)
  - 辅助: 12px

### 3.4 布局 (Layout)
- **响应式**: 适配 Mobile (<640px), Tablet (640px-1024px), Desktop (>1024px)。
- **容器**: 主内容区域应有最大宽度限制 (如 `max-w-7xl`) 并在大屏居中。
- **间距**: 使用 Tailwind 的 spacing scale (e.g., `p-4`, `m-2`, `gap-4`) 或 Semi 的 `Space` 组件。

### 3.5 组件使用 (Component Usage)
- **按钮 (Button)**: 使用 `<Button>` 组件，禁止使用原生 `<button>`。
- **表单 (Form)**: 使用 `<Form>` 及其字段组件，确保验证样式统一。
- **弹窗 (Modal)**: 使用 `<Modal>` 或 `<SideSheet>`，禁止自定义覆盖层。
- **表格 (Table)**: 使用 `<Table>` 组件，统一分页和筛选样式。

## 4. 实施指南

### 4.1 引入方式
确保在项目入口文件 (`main.jsx` 或 `index.jsx`) 中引入 Semi Design 样式：
```javascript
import '@douyinfe/semi-ui/dist/css/semi.min.css';
```

### 4.2 样式覆盖
尽量避免使用 `!important`。如果需要自定义 Semi 组件样式，请使用 CSS Modules 或 styled-components (如果项目中引入了)，或者在全局 CSS 中通过具体的 CSS 类名进行覆盖，但需添加注释说明原因。

### 4.3 兼容性
- 确保所有页面在 Chrome, Firefox, Safari, Edge 最新版中显示正常。
- 确保无障碍性 (A11y) 符合 WCAG 2.1 AA 标准 (Semi 组件自带大部分支持)。

## 5. 验收标准
1.  **路由**: 无 404 错误，路径规范。
2.  **视觉**: 90% 以上一致性，无明显样式冲突。
3.  **性能**: 页面加载速度无明显下降。
4.  **无障碍**: 键盘可导航，颜色对比度达标。
