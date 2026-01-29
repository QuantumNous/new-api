# 前端开发规范

本文档定义了前端项目的开发规范和最佳实践，所有开发人员都应遵循这些规范。

## 目录

- [国际化规范](#国际化规范)
- [代码规范](#代码规范)
- [组件规范](#组件规范)
- [类型规范](#类型规范)
- [性能规范](#性能规范)
- [状态管理规范](#状态管理规范)
- [API 请求规范](#api-请求规范)
- [表单处理规范](#表单处理规范)
- [路由规范](#路由规范)
- [错误处理规范](#错误处理规范)
- [样式规范](#样式规范)
- [文件组织规范](#文件组织规范)
- [可访问性规范](#可访问性规范)
- [安全性规范](#安全性规范)
- [测试规范](#测试规范)
- [依赖管理规范](#依赖管理规范)
- [构建和部署规范](#构建和部署规范)

---

## 技术栈

本项目主要采用以下前端技术栈：

- **bun**：包管理器
- **React 19**：主流响应式视图库，构建组件化 UI。
- **TypeScript**：为 JavaScript 提供静态类型支持，提升代码可维护性和可靠性。
- **@tanstack/react-query**：高效的数据请求和缓存管理库。
- **@tanstack/react-router**：现代化路由解决方案，响应式路由和嵌套路由设计。
- **@tanstack/react-table、@tanstack/react-virtual**：数据表格和虚拟滚动性能优化支持大数据量列表。
- **i18next + react-i18next + i18next-browser-languagedetector**：国际化框架，支持多语言适配和自动语言检测。
- **Day.js**：日期时间处理相关库。
- **Radix UI**：一套可访问性的无样式 UI 组件，用于快速构建交互组件（如弹窗、对话框、选择器等）。
- **Lucide React**：图标库。
- **Tailwind CSS**：原子化 CSS 框架，快速响应式样式编写。
- **clsx / class-variance-authority**：CSS className 工具。
- **React Hook Form**：高性能、易于扩展的表单处理方案。
- **axios**：HTTP 请求和数据交互。
- **prettier、eslint**：代码风格和质量保证工具。
- **vitest**（如有）：单元测试框架。
- **qrcode.react**：二维码渲染组件。
- **@visactor/vchart, @visactor/react-vchart**：数据可视化图表库。

如有部分定制或者三方库按需集成，以 package.json 为准。所有依赖均支持现代浏览器和模块化开发。

优先选择成熟、可靠的开源依赖库来实现功能，避免无必要的重复造轮子。仅当现有库无法满足业务需求、或为适配特殊情况时，才可考虑自行实现功能，并需充分评估可维护性和通用性。


## 国际化规范

### 文本国际化要求

1. **页面文本必须考虑国际化**
   - 任何在页面上显示的文本内容，都需要考虑是否需要进行 i18n 处理
   - 使用 `useTranslation` hook 和 `t()` 函数进行文本翻译
   - 示例：
     ```tsx
     // ✅ 正确
     const { t } = useTranslation()
     <div>{t('Welcome')}</div>
     
     // ❌ 错误
     <div>Welcome</div>
     ```

2. **`useTranslation()` vs `import { t } from 'i18next'` 的使用场景**
   
   **`const { t } = useTranslation()` - React 组件中的推荐方式**
   - ✅ **必须在 React 组件或自定义 Hook 中使用**
   - ✅ **会响应语言变化**：当用户切换语言时，使用此方式的组件会自动重新渲染并更新文本
   - ✅ **与 React 生命周期集成**：可以正确触发组件更新
   - 示例：
     ```tsx
     // ✅ 正确：在 React 组件中使用
     function MyComponent() {
       const { t } = useTranslation()
       return <div>{t('Hello')}</div>
     }
     ```
   
   **`import { t } from 'i18next'` - 非 React 环境使用**
   - ✅ **适用于非 React 环境**：工具函数、常量文件、类方法等
   - ⚠️ **不会直接响应语言变化**：组件本身不会因为语言切换而重新渲染
   - ⚠️ **可能间接更新**：如果父组件使用了 `useTranslation()` 并重新渲染，子组件也会重新渲染，此时 `t()` 会读取新的语言设置
   - ⚠️ **不可靠**：如果父组件没有重新渲染，或者组件是独立的，文本将不会更新
   - 示例：
     ```tsx
     // ✅ 正确：在非 React 工具函数中使用
     import { t } from 'i18next'
     
     export function getRoleLabel(role?: number): string {
       return t(getRoleLabelKey(role))
     }
     
     // ⚠️ 不推荐：在 React 组件中使用
     // 虽然可能因为父组件重新渲染而间接更新，但这不是可靠的方式
     function MyComponent() {
       return <div>{t('Hello')}</div> 
       // 如果父组件没有使用 useTranslation()，语言切换后不会更新
     }
     ```
   
   **选择原则：**
   - 在 React 组件中：**必须使用** `useTranslation()`，确保组件能够直接响应语言变化
   - 在工具函数、常量、类方法中：可以使用 `import { t } from 'i18next'`
   - 即使父组件使用了 `useTranslation()`，子组件也应该使用 `useTranslation()` 以确保独立性和可靠性

3. **专有名词处理**
   - 专有英文称谓（如品牌名、产品名、技术术语等）可以不进行翻译
   - 示例：API、React、TypeScript、OpenAI 等可以直接使用英文
   - 如果专有名词在特定语言环境下有约定俗成的翻译，应使用翻译版本

4. **翻译键命名规范**
   - 使用有意义的键名，避免过于简短或模糊
   - 建议使用点分隔的层级结构，如：`dashboard.overview.title`
   - 保持键名的一致性

---

## 代码规范

### 表达式复杂度

1. **禁止多层三元表达式**
   - 禁止使用 2 层及以上的三元表达式（嵌套三元运算符）
   - 应使用 `if-else` 语句、早期返回或函数提取来提高可读性
   - 示例：
     ```tsx
     // ❌ 错误：2层三元表达式
     const result = condition1 
       ? condition2 
         ? value1 
         : value2 
       : value3
     
     // ✅ 正确：使用 if-else
     let result
     if (condition1) {
       result = condition2 ? value1 : value2
     } else {
       result = value3
     }
     
     // ✅ 正确：使用函数提取
     const getResult = () => {
       if (condition1) {
         return condition2 ? value1 : value2
       }
       return value3
     }
     const result = getResult()
     ```

2. **单层三元表达式**
   - 单层三元表达式可以使用，但应保持简洁
   - 如果表达式过长或逻辑复杂，建议使用 `if-else` 语句

### 代码可读性

1. **函数复杂度**
   - 单个函数的圈复杂度应控制在合理范围内
   - 复杂逻辑应拆分为多个小函数

2. **命名规范**
   - 使用有意义的变量名和函数名
   - 遵循 TypeScript/JavaScript 命名约定（驼峰命名）

---

## 组件规范

### React 组件

1. **组件结构**
   - 使用函数式组件和 Hooks
   - 保持组件的单一职责原则
   - 组件文件应包含组件定义和相关的类型定义

2. **Props 类型**
   - 所有组件的 props 必须定义明确的类型
   - 使用 TypeScript 接口或类型别名定义 props

3. **组件拆分**
   - 当组件超过 200 行时，考虑拆分为更小的子组件
   - 提取可复用的逻辑到自定义 Hooks

---

## 类型规范

### TypeScript 使用

1. **类型定义**
   - 避免使用 `any` 类型，优先使用具体类型或 `unknown`
   - 为函数参数和返回值定义明确的类型
   - 使用类型推断时，确保类型清晰

2. **类型导入**
   - 使用 `import type` 导入仅用于类型的导入
   - 示例：
     ```tsx
     import type { User } from './types'
     ```

---

## 性能规范

### 性能优化

1. **React 性能**
   - 合理使用 `useMemo` 和 `useCallback` 避免不必要的重渲染
   - 避免在渲染函数中创建新的对象或数组
   - 使用 `React.memo` 优化组件渲染（仅在必要时）

2. **资源加载**
   - 图片应使用适当的格式和尺寸
   - 考虑使用懒加载处理大量数据或图片

3. **代码分割**
   - 合理使用动态导入（`React.lazy`）进行代码分割
   - 避免不必要的依赖引入

---

## 状态管理规范

### Zustand Store 使用

1. **Store 创建**
   - 使用 `create` 函数创建 store
   - Store 应该定义清晰的类型接口
   - 示例：
     ```tsx
     interface AuthState {
       auth: {
         user: AuthUser | null
         setUser: (user: AuthUser | null) => void
         reset: () => void
       }
     }
     
     export const useAuthStore = create<AuthState>()((set) => ({
       // store implementation
     }))
     ```

2. **Store 使用**
   - 在组件中使用 `useStore` hook 访问 store
   - 优先使用选择器（selector）来避免不必要的重渲染
   - 示例：
     ```tsx
     // ✅ 正确：使用选择器
     const user = useAuthStore((state) => state.auth.user)
     
     // ⚠️ 不推荐：直接访问整个 store
     const { auth } = useAuthStore()
     ```

3. **持久化**
   - 需要持久化的数据应使用 localStorage
   - 在 store 初始化时从 localStorage 恢复数据
   - 数据变更时同步更新 localStorage

4. **Store 组织**
   - 每个功能模块应有独立的 store 文件
   - Store 文件应放在 `src/stores/` 目录下
   - Store 命名应清晰表达其用途

---

## API 请求规范

### React Query 使用

1. **查询（Queries）**
   - 使用 `useQuery` 进行数据获取
   - 为每个查询定义唯一的 `queryKey`
   - 使用 `queryKey` 数组来组织层级结构
   - 示例：
     ```tsx
     const { data, isLoading, error } = useQuery({
       queryKey: ['users', userId],
       queryFn: () => getUser(userId),
     })
     ```

2. **变更（Mutations）**
   - 使用 `useMutation` 进行数据修改
   - 在 `onSuccess` 中使相关的查询失效（invalidate）
   - 使用乐观更新（optimistic updates）提升用户体验
   - 示例：
     ```tsx
     const mutation = useMutation({
       mutationFn: updateUser,
       onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['users'] })
       },
     })
     ```

3. **查询键（Query Keys）**
   - 使用数组形式定义查询键
   - 保持查询键的一致性
   - 使用常量定义查询键前缀，便于管理

4. **错误处理**
   - 在 `QueryClient` 的全局配置中处理通用错误
   - 在组件级别处理特定错误场景
   - 使用 `handleServerError` 统一处理服务器错误

### Axios 配置

1. **API 实例**
   - 使用统一的 `api` 实例进行请求
   - 配置默认的 `baseURL` 和 `headers`
   - 使用 `withCredentials: true` 处理跨域认证

2. **请求去重**
   - GET 请求默认启用去重机制
   - 使用 `disableDuplicate` 选项禁用特定请求的去重

3. **拦截器**
   - 使用请求拦截器添加认证 token
   - 使用响应拦截器处理通用错误和状态码

---

## 表单处理规范

### React Hook Form + Zod

1. **表单 Schema**
   - 使用 Zod 定义表单验证 schema
   - Schema 文件应放在功能模块的 `lib/` 目录下
   - 使用 `z.infer` 导出表单数据类型
   - 示例：
     ```tsx
     export const userFormSchema = z.object({
       username: z.string().min(1, 'Username is required'),
       email: z.string().email('Invalid email'),
     })
     
     export type UserFormValues = z.infer<typeof userFormSchema>
     ```

2. **表单组件**
   - 使用 `useForm` hook 管理表单状态
   - 使用 `@hookform/resolvers/zod` 集成 Zod 验证
   - 表单字段应使用受控组件
   - 示例：
     ```tsx
     const form = useForm<UserFormValues>({
       resolver: zodResolver(userFormSchema),
       defaultValues: { /* ... */ },
     })
     ```

3. **表单提交**
   - 在 `onSubmit` 中处理表单提交逻辑
   - 显示加载状态和错误提示
   - 成功后重置表单或关闭对话框

4. **表单验证**
   - 客户端验证使用 Zod schema
   - 服务器端验证错误应映射到对应字段
   - 提供清晰的错误提示信息

---

## 路由规范

### TanStack Router

1. **路由文件组织**
   - 路由文件使用文件系统路由
   - 路由文件应放在 `src/routes/` 目录下
   - 使用 `createFileRoute` 创建路由
   - 示例：
     ```tsx
     export const Route = createFileRoute('/_authenticated/users/')({
       component: Users,
     })
     ```

2. **路由守卫**
   - 使用 `beforeLoad` 进行路由级别的认证和授权
   - 在 `beforeLoad` 中处理重定向逻辑
   - 避免在 `beforeLoad` 中进行不必要的 API 调用

3. **搜索参数验证**
   - 使用 Zod schema 验证路由搜索参数
   - 在路由定义中使用 `validateSearch`
   - 示例：
     ```tsx
     const searchSchema = z.object({
       page: z.number().optional(),
       search: z.string().optional(),
     })
     
     export const Route = createFileRoute('/users/')({
       validateSearch: searchSchema,
       component: Users,
     })
     ```

4. **路由嵌套**
   - 使用布局路由（layout routes）组织嵌套结构
   - 使用 `_authenticated` 等前缀标识路由组
   - 在布局组件中使用 `<Outlet />` 渲染子路由

5. **路由导航**
   - 使用 `useNavigate` 或 `Link` 组件进行导航
   - 避免直接使用 `window.location`
   - 使用类型安全的路由导航

---

## 错误处理规范

### 统一错误处理

1. **服务器错误**
   - 使用 `handleServerError` 函数统一处理服务器错误
   - 在 React Query 的全局配置中处理通用错误
   - 根据 HTTP 状态码显示相应的错误提示

2. **错误提示**
   - 使用 `toast.error` 显示错误消息
   - 错误消息应使用国际化文本
   - 提供有意义的错误信息，避免技术细节

3. **错误边界**
   - 在路由级别使用错误组件（`errorComponent`）
   - 提供友好的错误页面
   - 记录错误信息便于调试

4. **表单错误**
   - 表单验证错误应显示在对应字段下方
   - 使用 `form.setError` 设置字段级错误
   - 服务器验证错误应映射到对应表单字段

---

## 样式规范

### Tailwind CSS

1. **类名使用**
   - 优先使用 Tailwind 工具类
   - 避免内联样式，除非是动态样式
   - 使用 `cn()` 工具函数合并类名
   - 示例：
     ```tsx
     <div className={cn('base-class', condition && 'conditional-class')} />
     ```

2. **响应式设计**
   - 使用 Tailwind 响应式前缀（`sm:`, `md:`, `lg:` 等）
   - 遵循移动优先的设计原则
   - 确保在所有设备上都有良好的体验

3. **主题支持**
   - 使用 CSS 变量支持主题切换
   - 暗色模式样式使用 `dark:` 前缀
   - 确保主题切换时样式正确应用

4. **自定义样式**
   - 自定义样式应放在 `src/styles/` 目录下
   - 使用 Tailwind 的 `@apply` 指令复用样式
   - 避免在组件中定义大量自定义 CSS

---

## 文件组织规范

### Features 目录结构

1. **功能模块组织**
   - 每个功能模块应放在 `src/features/` 目录下
   - 功能模块应包含以下子目录：
     - `components/` - 功能相关的组件
     - `lib/` - 工具函数、类型定义、常量
     - `hooks/` - 功能相关的自定义 Hooks
     - `api.ts` - API 请求函数（可选）
     - `types.ts` - 类型定义（可选）
     - `constants.ts` - 常量定义（可选）
     - `index.tsx` - 功能主入口组件

2. **组件组织**
   - 通用组件放在 `src/components/` 目录下
   - 功能特定组件放在对应功能的 `components/` 目录下
   - 组件文件应使用 PascalCase 命名

3. **工具函数组织**
   - 通用工具函数放在 `src/lib/` 目录下
   - 功能特定工具函数放在对应功能的 `lib/` 目录下
   - 工具函数文件应使用 kebab-case 命名

4. **类型定义**
   - 类型定义应放在 `types.ts` 或 `lib/types.ts` 文件中
   - 使用 `export type` 导出类型
   - 类型命名应使用 PascalCase

---

## 可访问性规范

### 无障碍访问（a11y）

1. **语义化 HTML**
   - 使用语义化的 HTML 元素
   - 正确使用 `header`、`nav`、`main`、`footer` 等标签
   - 表单使用 `label` 关联输入字段

2. **键盘导航**
   - 确保所有交互元素可以通过键盘访问
   - 提供清晰的焦点指示
   - 使用 `tabIndex` 控制焦点顺序

3. **ARIA 属性**
   - 在必要时使用 ARIA 属性增强可访问性
   - 使用 `aria-label` 提供描述性标签
   - 使用 `aria-expanded`、`aria-hidden` 等状态属性

4. **颜色对比度**
   - 确保文本和背景有足够的对比度
   - 遵循 WCAG 2.1 AA 级标准（至少 4.5:1）

5. **屏幕阅读器支持**
   - 为图标和装饰性元素添加 `aria-hidden="true"`
   - 为重要信息提供文本替代方案
   - 测试屏幕阅读器兼容性

---

## 安全性规范

### 安全最佳实践

1. **认证和授权**
   - 使用安全的认证机制（如 JWT、Session）
   - 在路由级别进行权限检查
   - 敏感操作需要额外的验证（如二次确认）

2. **数据验证**
   - 始终在客户端和服务器端都进行数据验证
   - 使用 Zod 等库进行类型安全的验证
   - 避免信任客户端提交的数据

3. **敏感信息处理**
   - 不在客户端存储敏感信息（如密码、API 密钥）
   - 使用环境变量管理配置信息
   - 避免在代码中硬编码敏感数据

4. **XSS 防护**
   - 使用 React 的自动转义机制
   - 避免使用 `dangerouslySetInnerHTML`，除非必要
   - 对用户输入进行适当的转义和验证

5. **CSRF 防护**
   - 使用 `withCredentials: true` 处理跨域请求
   - 确保 API 请求包含必要的 CSRF token

---

## 测试规范

### 测试策略

1. **单元测试**
   - 为工具函数和纯函数编写单元测试
   - 使用 Vitest 作为测试框架
   - 测试文件应放在 `.test.ts` 文件中

2. **组件测试**
   - 使用 React Testing Library 测试组件
   - 测试用户交互和组件行为
   - 避免测试实现细节

3. **集成测试**
   - 为关键用户流程编写集成测试
   - 测试 API 集成和状态管理
   - 使用 Mock Service Worker (MSW) 模拟 API

4. **E2E 测试**
   - 使用 Playwright 或 Cypress 进行端到端测试
   - 测试关键业务流程
   - 确保跨浏览器兼容性

5. **测试覆盖率**
   - 目标覆盖率：核心功能 80% 以上
   - 关注业务逻辑和关键路径的覆盖率
   - 使用覆盖率报告识别未测试的代码

---

## 依赖管理规范

### 依赖管理

1. **包管理器**
   - 项目使用 **Bun** 作为包管理器
   - 使用 `bun install` 安装依赖
   - 使用 `bun add <package>` 添加新依赖
   - 使用 `bun add -d <package>` 添加开发依赖
   - 使用 `bun remove <package>` 移除依赖

2. **依赖选择**
   - 优先选择维护活跃、社区支持良好的库
   - 评估依赖的大小和性能影响
   - 避免引入不必要的依赖

3. **版本管理**
   - 使用精确版本号（`^` 或 `~`）控制依赖版本
   - 定期更新依赖以获取安全补丁
   - 使用 `bun pm ls` 查看已安装的依赖
   - 定期运行 `bun update` 更新依赖到最新兼容版本

4. **依赖分类**
   - 区分 `dependencies` 和 `devDependencies`
   - 生产依赖不应包含开发工具
   - 使用 `peerDependencies` 声明兼容性要求

5. **依赖审查**
   - 在添加新依赖前进行审查
   - 考虑依赖的许可证兼容性
   - 评估依赖对打包体积的影响

---

## 构建和部署规范

### 构建配置

1. **包管理器和脚本**
   - 项目使用 **Bun** 作为包管理器和脚本运行器
   - 使用 `bun run <script>` 运行 package.json 中定义的脚本
   - 常用命令：
     - `bun run dev` - 启动开发服务器
     - `bun run build` - 构建生产版本
     - `bun run typecheck` - 类型检查
     - `bun run lint` - 代码检查
     - `bun run format` - 代码格式化

2. **构建工具**
   - 使用 Rsbuild 作为构建工具
   - 配置文件：`rsbuild.config.ts`
   - 使用环境变量区分开发和生产环境

3. **代码分割**
   - 使用动态导入（`React.lazy`）进行代码分割
   - 配置合理的 chunk 分割策略
   - 优化首屏加载时间

4. **资源优化**
   - 图片使用适当的格式（WebP、AVIF）
   - 使用图片懒加载
   - 压缩和优化静态资源

5. **环境变量**
   - 使用 `.env` 文件管理环境变量
   - 环境变量应使用 `VITE_` 前缀
   - 不在代码中硬编码配置值

6. **部署检查清单**
   - [ ] 运行类型检查（`bun run typecheck`）
   - [ ] 运行代码检查（`bun run lint`）
   - [ ] 运行格式化检查（`bun run format:check`）
   - [ ] 构建生产版本（`bun run build`）
   - [ ] 检查构建产物大小
   - [ ] 验证环境变量配置

---

## 其他规范

### 代码提交

1. **提交信息**
   - 使用清晰的提交信息，遵循项目约定的提交格式
   - 提交信息应描述变更的内容和原因
   - 使用中文或英文，保持一致性

2. **代码审查**
   - 所有代码变更应经过代码审查
   - 确保遵循本文档中的所有规范
   - 审查时关注代码质量、性能和安全性

3. **文档更新**
   - 重大功能变更应更新相关文档
   - 保持代码注释和文档的同步
   - 更新 `AGENTS.md` 记录新的规范

---

## 更新日志

- 2026-01-28: 初始版本，添加国际化规范和代码规范
- 2026-01-28: 扩展版本，添加状态管理、API 请求、表单处理、路由、错误处理、样式、文件组织、可访问性、安全性、测试、依赖管理和构建部署规范
