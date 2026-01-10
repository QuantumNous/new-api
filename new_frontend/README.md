# New API 前端项目 (基于 shadcn-ui)

> 全新的前端实现，采用现代化技术栈和原子设计方法论

## 📚 技术栈

### 核心框架
- **React 18.3** - UI 框架
- **Vite 5** - 构建工具
- **TypeScript 5** - 类型系统
- **React Router DOM 6** - 路由管理

### UI 组件库
- **shadcn/ui** - 基础组件库（基于 Radix UI）
- **Tailwind CSS 3** - 样式框架
- **Lucide React** - 图标库
- **class-variance-authority** - 样式变体管理
- **tailwind-merge** - 样式合并工具

### 状态管理
- **TanStack Query (React Query)** - 服务端状态管理
- **Zustand** - 客户端状态管理
- **React Context API** - 全局状态

### 表单处理
- **React Hook Form** - 表单管理
- **Zod** - 数据验证

### 其他工具
- **Axios** - HTTP 客户端
- **dayjs** - 日期处理
- **react-markdown** - Markdown 渲染
- **recharts** - 图表库
- **react-i18next** - 国际化

### 测试工具
- **Playwright** - E2E 测试（通过 MCP 集成）
- **Vitest** - 单元测试
- **Testing Library** - 组件测试

## 🏗️ 项目结构

```
new_frontend/
├── public/                 # 静态资源
│   ├── favicon.ico
│   └── logo.png
├── src/
│   ├── components/        # 组件库
│   │   ├── ui/           # shadcn-ui 基础组件
│   │   ├── atoms/        # 原子组件
│   │   ├── molecules/    # 分子组件
│   │   ├── organisms/    # 有机体组件
│   │   └── templates/    # 页面模板
│   ├── pages/            # 页面组件
│   │   ├── auth/         # 认证相关页面
│   │   ├── console/      # 控制台页面
│   │   ├── playground/   # 操练场页面
│   │   └── home/         # 首页
│   ├── lib/              # 工具库
│   │   ├── api/          # API 客户端
│   │   ├── utils/        # 工具函数
│   │   └── constants/    # 常量定义
│   ├── hooks/            # 自定义 Hooks
│   │   ├── queries/      # React Query Hooks
│   │   └── stores/       # Zustand Stores
│   ├── types/            # TypeScript 类型定义
│   ├── styles/           # 全局样式
│   ├── locales/          # 国际化文件
│   ├── App.tsx           # 应用入口
│   ├── main.tsx          # 主入口
│   └── vite-env.d.ts     # Vite 类型定义
├── tests/                # 测试文件
│   ├── e2e/             # E2E 测试
│   ├── unit/            # 单元测试
│   └── integration/     # 集成测试
├── .storybook/          # Storybook 配置
├── playwright.config.ts # Playwright 配置
├── tailwind.config.js   # Tailwind 配置
├── tsconfig.json        # TypeScript 配置
├── vite.config.ts       # Vite 配置
├── components.json      # shadcn-ui 配置
└── package.json         # 项目依赖
```

## 🎨 设计系统

### 原子设计方法论

#### 1. 原子层 (Atoms)
最基础的 UI 元素，不可再分：
- Button, Input, Label, Badge, Avatar
- Icon, Spinner, Divider
- Typography (Heading, Text, Code)

#### 2. 分子层 (Molecules)
由原子组合而成的简单组件：
- FormField (Label + Input + Error)
- SearchBox (Input + Icon + Button)
- StatusBadge (Badge + Icon)
- UserAvatar (Avatar + Text)

#### 3. 有机体层 (Organisms)
由分子和原子组成的复杂组件：
- Header, Sidebar, Footer
- DataTable, Form, Modal
- ChannelCard, TokenCard, UserCard

#### 4. 模板层 (Templates)
页面级布局结构：
- DashboardTemplate
- ListPageTemplate
- FormPageTemplate
- DetailPageTemplate

#### 5. 页面层 (Pages)
完整的页面实现：
- LoginPage, DashboardPage
- ChannelListPage, TokenListPage

### 颜色系统

基于 Tailwind CSS 的颜色系统，支持明暗主题：

```css
/* Light Theme */
--background: 0 0% 100%;
--foreground: 222.2 84% 4.9%;
--primary: 221.2 83.2% 53.3%;
--secondary: 210 40% 96.1%;
--accent: 210 40% 96.1%;
--destructive: 0 84.2% 60.2%;

/* Dark Theme */
--background: 222.2 84% 4.9%;
--foreground: 210 40% 98%;
--primary: 217.2 91.2% 59.8%;
--secondary: 217.2 32.6% 17.5%;
--accent: 217.2 32.6% 17.5%;
--destructive: 0 62.8% 30.6%;
```

### 间距系统

遵循 8px 基准网格：
- xs: 4px (0.5rem)
- sm: 8px (1rem)
- md: 16px (2rem)
- lg: 24px (3rem)
- xl: 32px (4rem)
- 2xl: 48px (6rem)

### 字体系统

```css
font-family: 
  -apple-system, BlinkMacSystemFont, 'Segoe UI', 
  'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 
  'Fira Sans', 'Droid Sans', 'Helvetica Neue', 
  sans-serif;

/* 字号 */
text-xs: 0.75rem (12px)
text-sm: 0.875rem (14px)
text-base: 1rem (16px)
text-lg: 1.125rem (18px)
text-xl: 1.25rem (20px)
text-2xl: 1.5rem (24px)
```

## 🔧 开发规范

### 组件开发规范

1. **文件命名**
   - 组件文件使用 PascalCase: `Button.tsx`
   - 工具文件使用 camelCase: `formatDate.ts`
   - 类型文件使用 PascalCase: `User.types.ts`

2. **组件结构**
```tsx
// 1. 导入
import React from 'react';
import { cn } from '@/lib/utils';

// 2. 类型定义
interface ButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

// 3. 组件实现
export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'md',
  children,
  ...props
}) => {
  return (
    <button
      className={cn(
        'rounded-md font-medium transition-colors',
        variants[variant],
        sizes[size]
      )}
      {...props}
    >
      {children}
    </button>
  );
};

// 4. 导出
export default Button;
```

3. **Hooks 规范**
```tsx
// useChannels.ts
import { useQuery } from '@tanstack/react-query';
import { channelService } from '@/lib/api/channel';

export const useChannels = (params?: ChannelQueryParams) => {
  return useQuery({
    queryKey: ['channels', params],
    queryFn: () => channelService.getAll(params),
    staleTime: 5 * 60 * 1000, // 5 分钟
  });
};
```

4. **API 服务规范**
```tsx
// channel.service.ts
import { api } from '@/lib/api/client';
import type { Channel, ChannelCreateInput } from '@/types/channel';

export const channelService = {
  getAll: (params?: ChannelQueryParams) => 
    api.get<Channel[]>('/channel/', { params }),
  
  getById: (id: number) => 
    api.get<Channel>(`/channel/${id}`),
  
  create: (data: ChannelCreateInput) => 
    api.post<Channel>('/channel/', data),
  
  update: (id: number, data: Partial<Channel>) => 
    api.put<Channel>(`/channel/${id}`, data),
  
  delete: (id: number) => 
    api.delete(`/channel/${id}`),
};
```

### 代码风格

- 使用 ESLint + Prettier 进行代码格式化
- 使用 TypeScript 严格模式
- 优先使用函数组件和 Hooks
- 使用命名导出而非默认导出（shadcn-ui 组件除外）
- 使用 `const` 声明常量，避免使用 `var`

### Git 提交规范

遵循 Conventional Commits：

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具链相关
```

示例：
```
feat(channel): 添加渠道列表分页功能
fix(auth): 修复登录页面 2FA 验证问题
docs(readme): 更新安装说明
```

## 🧪 测试策略

### 单元测试
使用 Vitest + Testing Library 测试组件和工具函数：

```tsx
// Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  
  it('handles click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    screen.getByText('Click').click();
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

### E2E 测试
使用 Playwright MCP 进行端到端测试：

```typescript
// channel.spec.ts
import { test, expect } from '@playwright/test';

test('create channel flow', async ({ page }) => {
  await page.goto('/console/channels/create');
  
  await page.fill('[name="name"]', 'Test Channel');
  await page.selectOption('[name="type"]', 'openai');
  await page.fill('[name="key"]', 'sk-test-key');
  
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/console/channels');
  await expect(page.locator('text=Test Channel')).toBeVisible();
});
```

### 测试覆盖率目标
- 单元测试覆盖率: ≥ 80%
- 集成测试覆盖率: ≥ 60%
- E2E 测试覆盖关键用户流程

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 运行测试
```bash
# 单元测试
npm run test

# E2E 测试
npm run test:e2e

# 测试覆盖率
npm run test:coverage
```

### 运行 Storybook
```bash
npm run storybook
```

## 📖 相关文档

- [shadcn-ui 使用规范](./docs/SHADCN_GUIDE.md)
- [Playwright MCP 集成说明](./docs/PLAYWRIGHT_MCP.md)
- [组件开发流程](./docs/COMPONENT_WORKFLOW.md)
- [API 集成指南](./docs/API_INTEGRATION.md)
- [部署指南](./docs/DEPLOYMENT.md)

## 🎯 开发路线图

- [x] 项目初始化和配置
- [ ] 基础组件库开发（原子层）
- [ ] 复合组件开发（分子层）
- [ ] 页面模板开发（有机体层）
- [ ] 认证模块实现
- [ ] 控制台核心功能
- [ ] 高级管理功能
- [ ] 测试和文档完善
- [ ] 性能优化
- [ ] 部署上线

## 📝 许可证

MIT License
