# 组件开发流程和验收标准

> 本文档定义了组件开发的完整流程和质量标准

## 🎯 开发流程

### 1. 需求分析阶段

#### 确定组件类型
- **原子组件**: 最基础的 UI 元素（Button, Input, Badge）
- **分子组件**: 由原子组合的简单组件（SearchBox, FormField）
- **有机体组件**: 复杂的业务组件（DataTable, ChannelCard）
- **模板组件**: 页面级布局（DashboardTemplate）

#### 定义组件规格
```typescript
// 组件规格文档示例
interface ComponentSpec {
  name: string;              // 组件名称
  type: 'atom' | 'molecule' | 'organism' | 'template';
  description: string;       // 功能描述
  props: PropDefinition[];   // 属性定义
  variants: Variant[];       // 变体定义
  states: State[];          // 状态定义
  accessibility: A11ySpec;   // 无障碍要求
  examples: Example[];       // 使用示例
}
```

### 2. 设计阶段

#### 创建设计规范
```typescript
// design-spec.ts
export const buttonDesignSpec = {
  variants: {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-input hover:bg-accent',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
  },
  sizes: {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 text-base',
    lg: 'h-11 px-8 text-lg',
  },
  states: {
    default: 'cursor-pointer',
    disabled: 'opacity-50 cursor-not-allowed',
    loading: 'opacity-70 cursor-wait',
  },
};
```

#### 定义 TypeScript 类型
```typescript
// Button.types.ts
import { ButtonHTMLAttributes } from 'react';
import { VariantProps } from 'class-variance-authority';

export interface ButtonProps 
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** 按钮是否处于加载状态 */
  loading?: boolean;
  /** 按钮左侧图标 */
  leftIcon?: React.ReactNode;
  /** 按钮右侧图标 */
  rightIcon?: React.ReactNode;
  /** 完整宽度 */
  fullWidth?: boolean;
}
```

### 3. 实现阶段

#### 组件实现模板

```tsx
// src/components/atoms/Button/Button.tsx
import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// 1. 定义变体
const buttonVariants = cva(
  // 基础样式
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

// 2. 定义 Props 接口
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

// 3. 组件实现
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

// 4. 导出
export default Button;
```

#### 组件样式指南

```typescript
// 使用 Tailwind 工具类
const styles = {
  // ✅ 好 - 使用语义化的 Tailwind 类
  container: 'flex items-center justify-between p-4 rounded-lg',
  
  // ❌ 不好 - 内联样式
  container: { display: 'flex', padding: '16px' },
  
  // ✅ 好 - 使用 cn 工具合并类名
  className: cn('base-class', condition && 'conditional-class', className),
  
  // ❌ 不好 - 字符串拼接
  className: `base-class ${condition ? 'conditional-class' : ''} ${className}`,
};
```

### 4. 测试阶段

#### 单元测试

```typescript
// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  describe('渲染', () => {
    it('应该正确渲染子元素', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('应该应用自定义类名', () => {
      render(<Button className="custom-class">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });

  describe('变体', () => {
    it('应该渲染默认变体', () => {
      render(<Button>Default</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-primary');
    });

    it('应该渲染 outline 变体', () => {
      render(<Button variant="outline">Outline</Button>);
      expect(screen.getByRole('button')).toHaveClass('border');
    });
  });

  describe('状态', () => {
    it('应该禁用按钮', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('应该显示加载状态', () => {
      render(<Button loading>Loading</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByRole('button')).toContainHTML('animate-spin');
    });
  });

  describe('交互', () => {
    it('应该处理点击事件', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('加载时不应触发点击事件', () => {
      const handleClick = vi.fn();
      render(<Button loading onClick={handleClick}>Loading</Button>);
      
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('图标', () => {
    it('应该渲染左侧图标', () => {
      render(
        <Button leftIcon={<span data-testid="left-icon">←</span>}>
          With Icon
        </Button>
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    });

    it('应该渲染右侧图标', () => {
      render(
        <Button rightIcon={<span data-testid="right-icon">→</span>}>
          With Icon
        </Button>
      );
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });
  });

  describe('无障碍', () => {
    it('应该支持 aria-label', () => {
      render(<Button aria-label="Close">×</Button>);
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('应该支持键盘导航', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Button</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();
      
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalled();
    });
  });
});
```

#### 集成测试

```typescript
// ChannelForm.integration.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChannelForm } from './ChannelForm';

describe('ChannelForm 集成测试', () => {
  it('应该完成完整的表单提交流程', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    
    render(<ChannelForm onSubmit={onSubmit} />);
    
    // 填写表单
    await user.type(screen.getByLabelText('名称'), 'Test Channel');
    await user.selectOptions(screen.getByLabelText('类型'), 'openai');
    await user.type(screen.getByLabelText('API 密钥'), 'sk-test-key');
    
    // 提交表单
    await user.click(screen.getByRole('button', { name: '创建' }));
    
    // 验证提交
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'Test Channel',
        type: 'openai',
        key: 'sk-test-key',
      });
    });
  });
});
```

### 5. 文档阶段

#### Storybook 故事

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { Plus, Download } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'icon'],
    },
    loading: {
      control: 'boolean',
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// 基础示例
export const Default: Story = {
  args: {
    children: 'Button',
  },
};

// 变体
export const Variants: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

// 尺寸
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  ),
};

// 带图标
export const WithIcons: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button leftIcon={<Plus className="h-4 w-4" />}>
        添加
      </Button>
      <Button rightIcon={<Download className="h-4 w-4" />}>
        下载
      </Button>
    </div>
  ),
};

// 加载状态
export const Loading: Story = {
  args: {
    loading: true,
    children: '加载中...',
  },
};

// 禁用状态
export const Disabled: Story = {
  args: {
    disabled: true,
    children: '禁用按钮',
  },
};

// 完整宽度
export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: '完整宽度按钮',
  },
};
```

#### 组件文档

```markdown
<!-- Button.mdx -->
# Button 按钮

用于触发操作的按钮组件。

## 导入

\`\`\`tsx
import { Button } from '@/components/atoms/Button';
\`\`\`

## 使用

### 基础用法

\`\`\`tsx
<Button>点击我</Button>
\`\`\`

### 变体

\`\`\`tsx
<Button variant="default">默认</Button>
<Button variant="outline">轮廓</Button>
<Button variant="ghost">幽灵</Button>
<Button variant="destructive">危险</Button>
\`\`\`

### 尺寸

\`\`\`tsx
<Button size="sm">小</Button>
<Button size="md">中</Button>
<Button size="lg">大</Button>
\`\`\`

### 带图标

\`\`\`tsx
<Button leftIcon={<Plus />}>添加</Button>
<Button rightIcon={<Download />}>下载</Button>
\`\`\`

### 加载状态

\`\`\`tsx
<Button loading>加载中...</Button>
\`\`\`

## API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| variant | `'default' \| 'destructive' \| 'outline' \| 'secondary' \| 'ghost' \| 'link'` | `'default'` | 按钮变体 |
| size | `'sm' \| 'md' \| 'lg' \| 'icon'` | `'md'` | 按钮尺寸 |
| loading | `boolean` | `false` | 加载状态 |
| leftIcon | `ReactNode` | - | 左侧图标 |
| rightIcon | `ReactNode` | - | 右侧图标 |
| fullWidth | `boolean` | `false` | 完整宽度 |
| disabled | `boolean` | `false` | 禁用状态 |

## 无障碍

- 支持键盘导航（Enter 和 Space 键）
- 支持 `aria-label` 属性
- 禁用状态下自动添加 `aria-disabled`
- 加载状态下自动添加 `aria-busy`

## 最佳实践

1. 使用语义化的按钮文本
2. 为图标按钮提供 `aria-label`
3. 避免在按钮中使用过长的文本
4. 使用合适的变体表达操作的重要性
```

### 6. 代码审查阶段

#### 审查清单

```markdown
## 代码审查清单

### 代码质量
- [ ] 代码符合 TypeScript 严格模式
- [ ] 没有 ESLint 警告或错误
- [ ] 代码格式符合 Prettier 规范
- [ ] 变量和函数命名清晰明确
- [ ] 没有未使用的导入或变量
- [ ] 没有 console.log 或调试代码

### 组件设计
- [ ] 组件职责单一，易于理解
- [ ] Props 接口定义完整且类型安全
- [ ] 使用 forwardRef 支持 ref 传递
- [ ] 正确使用 React.memo 优化性能
- [ ] 事件处理函数命名规范（handle* 或 on*）

### 样式
- [ ] 使用 Tailwind CSS 工具类
- [ ] 使用 cn 工具合并类名
- [ ] 支持自定义 className
- [ ] 响应式设计实现正确
- [ ] 主题切换正常工作

### 测试
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 测试用例覆盖主要功能
- [ ] 测试用例覆盖边界情况
- [ ] 测试用例覆盖错误处理
- [ ] 所有测试通过

### 无障碍
- [ ] 使用语义化 HTML 标签
- [ ] 提供适当的 ARIA 属性
- [ ] 支持键盘导航
- [ ] 颜色对比度符合 WCAG 标准
- [ ] 屏幕阅读器友好

### 文档
- [ ] Storybook 故事完整
- [ ] 组件文档清晰
- [ ] 使用示例充分
- [ ] API 文档准确
- [ ] 注释清晰有用

### 性能
- [ ] 避免不必要的重渲染
- [ ] 使用 useMemo 和 useCallback 优化
- [ ] 图片使用适当的格式和尺寸
- [ ] 避免内存泄漏
```

## ✅ 验收标准

### 功能验收

1. **核心功能**
   - ✅ 所有 Props 正常工作
   - ✅ 所有变体正确渲染
   - ✅ 所有状态正确显示
   - ✅ 事件处理正确执行

2. **边界情况**
   - ✅ 空值处理正确
   - ✅ 异常输入处理正确
   - ✅ 极限值处理正确

3. **兼容性**
   - ✅ 支持所有目标浏览器
   - ✅ 移动端显示正常
   - ✅ 不同屏幕尺寸适配

### 质量验收

1. **代码质量**
   - ✅ TypeScript 类型完整
   - ✅ 无 ESLint 错误
   - ✅ 代码格式规范
   - ✅ 注释清晰充分

2. **测试覆盖**
   - ✅ 单元测试覆盖率 ≥ 80%
   - ✅ 关键路径有集成测试
   - ✅ 所有测试通过

3. **性能指标**
   - ✅ 首次渲染 < 100ms
   - ✅ 交互响应 < 50ms
   - ✅ 无内存泄漏

### 文档验收

1. **Storybook**
   - ✅ 所有变体有故事
   - ✅ 交互示例完整
   - ✅ 控件配置正确

2. **组件文档**
   - ✅ 使用说明清晰
   - ✅ API 文档完整
   - ✅ 示例代码可运行

3. **无障碍文档**
   - ✅ 键盘操作说明
   - ✅ 屏幕阅读器说明
   - ✅ ARIA 属性说明

### 无障碍验收

1. **键盘导航**
   - ✅ Tab 键可聚焦
   - ✅ Enter/Space 可激活
   - ✅ Esc 可关闭（如适用）

2. **屏幕阅读器**
   - ✅ 语义化标签正确
   - ✅ ARIA 属性完整
   - ✅ 状态变化可感知

3. **视觉**
   - ✅ 颜色对比度 ≥ 4.5:1
   - ✅ 焦点指示清晰
   - ✅ 文本可缩放

## 📋 检查清单

### 开发前
- [ ] 需求明确
- [ ] 设计规范完成
- [ ] 类型定义完成
- [ ] 测试计划制定

### 开发中
- [ ] 代码符合规范
- [ ] 单元测试编写
- [ ] Storybook 故事编写
- [ ] 自测通过

### 开发后
- [ ] 代码审查通过
- [ ] 测试覆盖达标
- [ ] 文档完整
- [ ] 无障碍验收通过
- [ ] 性能指标达标

## 🚀 发布流程

1. **版本号更新**
   ```bash
   npm version patch  # 修复
   npm version minor  # 新功能
   npm version major  # 破坏性变更
   ```

2. **变更日志**
   ```markdown
   ## [1.2.0] - 2025-01-04
   
   ### Added
   - 新增 loading 属性
   - 新增 leftIcon 和 rightIcon 支持
   
   ### Changed
   - 优化按钮动画效果
   
   ### Fixed
   - 修复禁用状态下仍可点击的问题
   ```

3. **发布**
   ```bash
   git add .
   git commit -m "feat(button): 添加图标支持"
   git push origin main
   ```

## 📚 参考资源

- [React 组件设计模式](https://reactpatterns.com)
- [Atomic Design](https://atomicdesign.bradfrost.com)
- [Testing Library](https://testing-library.com)
- [Storybook](https://storybook.js.org)
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)
