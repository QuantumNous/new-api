---
title: How to Integrate TanStack Router with Shadcn/ui
---

This guide covers setting up Shadcn/ui with TanStack Router, including solutions for common animation and compatibility issues.

## Quick Start

**Time Required:** 30-45 minutes  
**Difficulty:** Intermediate  
**Prerequisites:** Existing TanStack Router project

### What You'll Accomplish

- Install and configure Shadcn/ui with TanStack Router
- Fix animation issues with modals, sheets, and dialogs
- Create type-safe navigation components
- Set up proper styling integration
- Resolve common compatibility problems

---

## Installation and Setup

### Step 1: Install Shadcn/ui

**Option 1: New project with TanStack Router template**

```bash
npx create-tsrouter-app@latest my-app --template file-router --tailwind --add-ons shadcn
```

**Option 2: Add to existing TanStack Router project**

```bash
npx shadcn@latest init
```

### Step 2: Configure components.json

Create or update your `components.json` for TanStack Router compatibility:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

### Step 3: Add Essential Components

Install the most commonly used components:

```bash
npx shadcn@latest add button
npx shadcn@latest add navigation-menu
npx shadcn@latest add sheet
npx shadcn@latest add dialog
```

---

## Fixing Animation Issues

### Step 1: Set Up Proper DOM Structure

Update your root route to support portals and animations:

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
  component: () => (
    <>
      {/* Main content wrapper */}
      <div id="root-content">
        <Outlet />
      </div>

      {/* Portal root for overlays */}
      <div id="portal-root"></div>

      <TanStackRouterDevtools />
    </>
  ),
})
```

### Step 2: Create Router-Compatible Sheet Component

Shadcn/ui Sheet components can have animation issues. Create a wrapper:

```tsx
// src/components/ui/router-sheet.tsx
import * as React from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

interface RouterSheetProps {
  children: React.ReactNode
  trigger: React.ReactNode
  title: string
  description?: string
  onOpenChange?: (open: boolean) => void
}

export function RouterSheet({
  children,
  trigger,
  title,
  description,
  onOpenChange,
}: RouterSheetProps) {
  const [open, setOpen] = React.useState(false)

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="mt-4">{children}</div>
      </SheetContent>
    </Sheet>
  )
}
```

### Step 3: Create Router-Compatible Dialog Component

```tsx
// src/components/ui/router-dialog.tsx
import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface RouterDialogProps {
  children: React.ReactNode
  trigger: React.ReactNode
  title: string
  description?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function RouterDialog({
  children,
  trigger,
  title,
  description,
  open: controlledOpen,
  onOpenChange,
}: RouterDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)

  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="mt-4">{children}</div>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Creating Navigation Components

### Step 1: Router-Compatible Navigation Menu

```tsx
// src/components/navigation/main-nav.tsx
import { Link, useMatchRoute } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'

interface NavItem {
  to: string
  label: string
  exact?: boolean
}

interface MainNavProps {
  items: NavItem[]
  className?: string
}

export function MainNav({ items, className }: MainNavProps) {
  const matchRoute = useMatchRoute()

  return (
    <NavigationMenu className={className}>
      <NavigationMenuList>
        {items.map((item) => {
          const isActive = matchRoute({ to: item.to, fuzzy: !item.exact })

          return (
            <NavigationMenuItem key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  navigationMenuTriggerStyle(),
                  isActive && 'bg-accent text-accent-foreground font-medium',
                )}
              >
                {item.label}
              </Link>
            </NavigationMenuItem>
          )
        })}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
```

### Step 2: Create Router-Compatible Button Links

```tsx
// src/components/ui/router-button.tsx
import { createLink } from '@tanstack/react-router'
import { Button, type ButtonProps } from '@/components/ui/button'
import { forwardRef } from 'react'

// Create a router-compatible Button
export const RouterButton = createLink(
  forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
    return <Button ref={ref} {...props} />
  }),
)
```

### Step 3: Usage Example

```tsx
// src/routes/posts/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { MainNav } from '@/components/navigation/main-nav'
import { RouterButton } from '@/components/ui/router-button'
import { RouterSheet } from '@/components/ui/router-sheet'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/posts/')({
  component: PostsPage,
})

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/posts', label: 'Posts', exact: true },
  { to: '/about', label: 'About' },
]

function PostsPage() {
  return (
    <div className="container mx-auto p-4">
      {/* Navigation with active states */}
      <MainNav items={navItems} className="mb-8" />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Posts</h1>

        {/* Router-compatible button */}
        <RouterButton to="/posts/new" variant="default">
          Create Post
        </RouterButton>
      </div>

      {/* Sheet with proper animations */}
      <RouterSheet
        trigger={<Button variant="outline">Open Menu</Button>}
        title="Navigation Menu"
        description="Navigate through your posts"
      >
        <div className="space-y-4">
          <p>This sheet animates correctly with TanStack Router!</p>
          <RouterButton to="/posts/new" variant="default" className="w-full">
            Create New Post
          </RouterButton>
        </div>
      </RouterSheet>
    </div>
  )
}
```

---

## Common Problems

### Animation Components Not Working

**Problem:** Sheet, Dialog, or other animated components don't animate properly.

**Solutions:**

1. **Ensure proper portal setup:**

   ```tsx
   // Add to your index.html or root component
   <div id="portal-root"></div>
   ```

2. **Check CSS imports order:**

   ```css
   /* Make sure this comes before your custom styles */
   @import 'tailwindcss/base';
   @import 'tailwindcss/components';
   @import 'tailwindcss/utilities';
   ```

3. **Use controlled components for complex animations:**

   ```tsx
   const [open, setOpen] = useState(false)

   // Controlled instead of uncontrolled
   <Sheet open={open} onOpenChange={setOpen}>
   ```

### TypeScript Errors with Router Integration

**Problem:** TypeScript errors when using Shadcn/ui components with TanStack Router.

**Solution:** Use `createLink` for proper typing:

```tsx
import { createLink } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

// This provides full type safety
export const RouterButton = createLink(Button)
```

### Styling Conflicts

**Problem:** Shadcn/ui styles conflict with router or custom styles.

**Solutions:**

1. **Use CSS layers:**

   ```css
   @layer base, components, utilities;

   @layer base {
     /* Shadcn/ui base styles */
   }

   @layer components {
     /* Your component styles */
   }
   ```

2. **Increase specificity for router-specific styles:**
   ```tsx
   <Button className="router-active:bg-primary router-active:text-primary-foreground">
     Active Button
   </Button>
   ```

### Dark Mode Integration

**Problem:** Dark mode doesn't work properly with route changes.

**Solution:** Set up theme provider correctly:

```tsx
// src/components/theme-provider.tsx
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

const ThemeProviderContext = createContext<{
  theme: Theme
  setTheme: (theme: Theme) => void
}>({
  theme: 'system',
  setTheme: () => null,
})

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'ui-theme',
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  )

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')
  return context
}
```

---

## Production Checklist

Before deploying your Shadcn/ui + TanStack Router app:

### Styling

- [ ] All Shadcn/ui components render correctly
- [ ] Animations work properly on route changes
- [ ] Dark mode integration working (if applicable)
- [ ] CSS conflicts resolved
- [ ] Responsive design tested

### Functionality

- [ ] Navigation components work with router state
- [ ] Active states properly reflected
- [ ] TypeScript compilation successful
- [ ] All sheets, dialogs, and modals animate correctly

### Performance

- [ ] Bundle size optimized (tree shaking working)
- [ ] CSS-in-JS not causing performance issues
- [ ] Animation performance acceptable on slower devices

---

## Related Resources

- [Shadcn/ui TanStack Router Installation](https://ui.shadcn.com/docs/installation/tanstack-router) - Official integration guide
- [TanStack Router createLink API](../api/router#createlink) - API documentation for component integration
- [Shadcn/ui Components](https://ui.shadcn.com/docs/components) - Complete component documentation
