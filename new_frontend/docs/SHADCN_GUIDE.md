# shadcn-ui 使用规范

> 本文档详细说明如何在项目中使用 shadcn-ui 组件库

## 📦 什么是 shadcn-ui

shadcn-ui 不是传统的组件库，而是一个**可复用组件的集合**。它的特点是：

- ✅ 组件代码直接复制到项目中，完全可控
- ✅ 基于 Radix UI，提供无障碍访问支持
- ✅ 使用 Tailwind CSS 进行样式定制
- ✅ 支持 TypeScript
- ✅ 完全可定制，无需覆盖样式

## 🚀 初始化配置

### 1. 安装依赖

```bash
npm install -D tailwindcss postcss autoprefixer
npm install class-variance-authority clsx tailwind-merge
npm install @radix-ui/react-slot
```

### 2. 初始化 shadcn-ui

```bash
npx shadcn-ui@latest init
```

配置选项：
```
✔ Would you like to use TypeScript? … yes
✔ Which style would you like to use? › Default
✔ Which color would you like to use as base color? › Slate
✔ Where is your global CSS file? … src/styles/globals.css
✔ Would you like to use CSS variables for colors? … yes
✔ Where is your tailwind.config.js located? … tailwind.config.js
✔ Configure the import alias for components: … @/components
✔ Configure the import alias for utils: … @/lib/utils
✔ Are you using React Server Components? … no
```

### 3. 配置文件说明

#### components.json
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

#### tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

## 🎨 添加组件

### 使用 CLI 添加组件

```bash
# 添加单个组件
npx shadcn-ui@latest add button

# 添加多个组件
npx shadcn-ui@latest add button input label

# 查看所有可用组件
npx shadcn-ui@latest add
```

### 常用组件列表

#### 基础组件
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add select
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add radio-group
npx shadcn-ui@latest add switch
npx shadcn-ui@latest add slider
```

#### 布局组件
```bash
npx shadcn-ui@latest add card
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add accordion
npx shadcn-ui@latest add collapsible
```

#### 反馈组件
```bash
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add alert-dialog
npx shadcn-ui@latest add sheet
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add tooltip
```

#### 数据展示
```bash
npx shadcn-ui@latest add table
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add progress
```

#### 导航组件
```bash
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add navigation-menu
npx shadcn-ui@latest add menubar
npx shadcn-ui@latest add breadcrumb
npx shadcn-ui@latest add pagination
```

#### 表单组件
```bash
npx shadcn-ui@latest add form
npx shadcn-ui@latest add calendar
npx shadcn-ui@latest add date-picker
npx shadcn-ui@latest add command
```

## 💡 组件使用示例

### Button 组件

```tsx
import { Button } from "@/components/ui/button"

export function ButtonDemo() {
  return (
    <div className="flex gap-2">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  )
}

// 尺寸变体
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon">
  <IconPlus className="h-4 w-4" />
</Button>
```

### Form 组件（配合 React Hook Form）

```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const formSchema = z.object({
  username: z.string().min(2, {
    message: "用户名至少 2 个字符",
  }),
  email: z.string().email({
    message: "请输入有效的邮箱地址",
  }),
})

export function ProfileForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
    },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>用户名</FormLabel>
              <FormControl>
                <Input placeholder="请输入用户名" {...field} />
              </FormControl>
              <FormDescription>
                这是您的公开显示名称
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>邮箱</FormLabel>
              <FormControl>
                <Input placeholder="请输入邮箱" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">提交</Button>
      </form>
    </Form>
  )
}
```

### Table 组件

```tsx
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const channels = [
  { id: 1, name: "OpenAI", type: "openai", status: "enabled" },
  { id: 2, name: "Anthropic", type: "claude", status: "enabled" },
  { id: 3, name: "Google", type: "gemini", status: "disabled" },
]

export function ChannelTable() {
  return (
    <Table>
      <TableCaption>渠道列表</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>名称</TableHead>
          <TableHead>类型</TableHead>
          <TableHead>状态</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {channels.map((channel) => (
          <TableRow key={channel.id}>
            <TableCell>{channel.id}</TableCell>
            <TableCell>{channel.name}</TableCell>
            <TableCell>{channel.type}</TableCell>
            <TableCell>{channel.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### Dialog 组件

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function CreateChannelDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>创建渠道</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>创建新渠道</DialogTitle>
          <DialogDescription>
            填写渠道信息以创建新的 API 渠道
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              名称
            </Label>
            <Input id="name" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="type" className="text-right">
              类型
            </Label>
            <Input id="type" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Toast 通知

```tsx
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"

export function ToastDemo() {
  const { toast } = useToast()

  return (
    <Button
      onClick={() => {
        toast({
          title: "操作成功",
          description: "渠道已成功创建",
        })
      }}
    >
      显示通知
    </Button>
  )
}

// 不同类型的通知
toast({
  title: "成功",
  description: "操作已完成",
})

toast({
  variant: "destructive",
  title: "错误",
  description: "操作失败，请重试",
})
```

## 🎯 最佳实践

### 1. 组件定制

shadcn-ui 组件可以直接修改源码进行定制：

```tsx
// src/components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "underline-offset-4 hover:underline text-primary",
        // 添加自定义变体
        success: "bg-green-600 text-white hover:bg-green-700",
      },
      size: {
        default: "h-10 py-2 px-4",
        sm: "h-9 px-3 rounded-md",
        lg: "h-11 px-8 rounded-md",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

### 2. 创建复合组件

基于 shadcn-ui 组件创建业务组件：

```tsx
// src/components/molecules/StatusBadge.tsx
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Clock } from "lucide-react"

interface StatusBadgeProps {
  status: 'enabled' | 'disabled' | 'pending'
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    enabled: {
      icon: CheckCircle,
      label: '启用',
      variant: 'default' as const,
    },
    disabled: {
      icon: XCircle,
      label: '禁用',
      variant: 'destructive' as const,
    },
    pending: {
      icon: Clock,
      label: '待审核',
      variant: 'secondary' as const,
    },
  }

  const { icon: Icon, label, variant } = config[status]

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}
```

### 3. 响应式设计

使用 Tailwind 的响应式工具类：

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {channels.map((channel) => (
    <Card key={channel.id}>
      <CardHeader>
        <CardTitle>{channel.name}</CardTitle>
      </CardHeader>
    </Card>
  ))}
</div>
```

### 4. 主题切换

```tsx
// src/components/ThemeProvider.tsx
import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

const ThemeProviderContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
}>({
  theme: "system",
  setTheme: () => null,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system")

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"
      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  return (
    <ThemeProviderContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeProviderContext)
```

### 5. 表单验证

结合 Zod 进行类型安全的表单验证：

```tsx
import * as z from "zod"

export const channelSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(50, "名称不能超过50个字符"),
  type: z.enum(["openai", "claude", "gemini"], {
    required_error: "请选择渠道类型",
  }),
  key: z.string().min(1, "API密钥不能为空"),
  baseUrl: z.string().url("请输入有效的URL").optional(),
  priority: z.number().int().min(0).max(100),
  weight: z.number().int().min(0).max(100),
})

export type ChannelFormData = z.infer<typeof channelSchema>
```

## 📚 参考资源

- [shadcn-ui 官方文档](https://ui.shadcn.com)
- [Radix UI 文档](https://www.radix-ui.com)
- [Tailwind CSS 文档](https://tailwindcss.com)
- [class-variance-authority](https://cva.style/docs)
- [React Hook Form](https://react-hook-form.com)
- [Zod](https://zod.dev)

## ⚠️ 注意事项

1. **不要通过 npm 安装 shadcn-ui**
   - shadcn-ui 不是 npm 包，而是通过 CLI 复制组件代码

2. **组件代码归你所有**
   - 可以自由修改组件源码
   - 不需要担心版本升级问题

3. **保持一致性**
   - 使用统一的设计令牌（颜色、间距、字体）
   - 遵循项目的组件命名规范

4. **性能优化**
   - 使用动态导入减少初始包大小
   - 避免过度使用动画效果

5. **可访问性**
   - 保持 Radix UI 提供的无障碍特性
   - 添加适当的 ARIA 标签
