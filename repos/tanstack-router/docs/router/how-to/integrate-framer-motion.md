---
title: How to Integrate TanStack Router with Framer Motion
---

This guide covers setting up Framer Motion with TanStack Router for smooth route transitions and navigation animations.

## Quick Start

**Time Required:** 30-45 minutes  
**Difficulty:** Intermediate  
**Prerequisites:** Existing TanStack Router project

### What You'll Accomplish

- Install and configure Framer Motion with TanStack Router
- Create smooth route transition animations
- Implement animated navigation components
- Set up layout animations and shared elements
- Handle complex animation sequences

---

## Installation and Setup

### Step 1: Install Framer Motion

```bash
npm install framer-motion
```

### Step 2: Verify Version Compatibility

Ensure you're using compatible versions:

```json
{
  "dependencies": {
    "@tanstack/react-router": "^1.0.0",
    "framer-motion": "^11.0.0",
    "react": "^18.0.0"
  }
}
```

---

## Route Transition Animations

### Step 1: Create Animated Route Wrapper

```tsx
// src/components/animated-route.tsx
import { motion, type MotionProps, type Variants } from 'framer-motion'
import { ReactNode } from 'react'

interface AnimatedRouteProps extends MotionProps {
  children: ReactNode
  variant?: 'fade' | 'slide' | 'scale' | 'slideUp'
}

const routeVariants: Record<string, Variants> = {
  fade: {
    initial: { opacity: 0 },
    in: { opacity: 1 },
    out: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, x: -20 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: 20 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    in: { opacity: 1, scale: 1 },
    out: { opacity: 0, scale: 1.05 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -20 },
  },
}

const pageTransition = {
  type: 'tween',
  ease: 'anticipate',
  duration: 0.3,
}

export function AnimatedRoute({
  children,
  variant = 'fade',
  ...motionProps
}: AnimatedRouteProps) {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={routeVariants[variant]}
      transition={pageTransition}
      {...motionProps}
    >
      {children}
    </motion.div>
  )
}
```

### Step 2: Set Up Route Animation Container

```tsx
// src/components/route-animation-container.tsx
import { useRouter } from '@tanstack/react-router'
import { AnimatePresence } from 'framer-motion'
import { ReactNode } from 'react'

interface RouteAnimationContainerProps {
  children: ReactNode
}

export function RouteAnimationContainer({
  children,
}: RouteAnimationContainerProps) {
  const router = useRouter()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <div key={router.state.location.pathname}>{children}</div>
    </AnimatePresence>
  )
}
```

### Step 3: Update Root Route for Animations

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { RouteAnimationContainer } from '@/components/route-animation-container'

export const Route = createRootRoute({
  component: () => (
    <>
      <RouteAnimationContainer>
        <Outlet />
      </RouteAnimationContainer>
      <TanStackRouterDevtools />
    </>
  ),
})
```

### Step 4: Use Animations in Routes

```tsx
// src/routes/posts/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { AnimatedRoute } from '@/components/animated-route'

export const Route = createFileRoute('/posts/')({
  component: PostsPage,
})

function PostsPage() {
  return (
    <AnimatedRoute variant="slide">
      <div className="container mx-auto p-4">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-bold mb-6"
        >
          Posts
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid gap-4"
        >
          {/* Post cards with staggered animations */}
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="border rounded-lg p-4"
            >
              <h2 className="text-xl font-semibold">{post.title}</h2>
              <p className="text-gray-600">{post.excerpt}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </AnimatedRoute>
  )
}
```

---

## Animated Navigation Components

### Step 1: Create Animated Tab Navigation

```tsx
// src/components/navigation/animated-tabs.tsx
import { Link, useMatchRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'

interface TabItem {
  to: string
  label: string
  exact?: boolean
}

interface AnimatedTabsProps {
  items: TabItem[]
  className?: string
}

export function AnimatedTabs({ items, className }: AnimatedTabsProps) {
  const matchRoute = useMatchRoute()

  return (
    <nav className={`flex space-x-1 p-2 bg-gray-100 rounded-lg ${className}`}>
      {items.map((item) => {
        const isActive = matchRoute({ to: item.to, fuzzy: !item.exact })

        return (
          <Link
            key={item.to}
            to={item.to}
            className={`relative px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white rounded-md shadow-sm"
                initial={false}
                transition={{
                  type: 'spring',
                  bounce: 0.2,
                  duration: 0.6,
                }}
              />
            )}
            <span className="relative z-10">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

### Step 2: Create Sliding Mobile Menu

```tsx
// src/components/navigation/animated-mobile-menu.tsx
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'

interface MenuItem {
  to: string
  label: string
  icon?: React.ReactNode
}

interface AnimatedMobileMenuProps {
  items: MenuItem[]
  trigger: React.ReactNode
}

export function AnimatedMobileMenu({
  items,
  trigger,
}: AnimatedMobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const menuVariants = {
    closed: {
      opacity: 0,
      x: '-100%',
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 40,
      },
    },
    open: {
      opacity: 1,
      x: 0,
      transition: {
        type: 'spring',
        stiffness: 400,
        damping: 40,
      },
    },
  }

  const itemVariants = {
    closed: { opacity: 0, x: -20 },
    open: { opacity: 1, x: 0 },
  }

  return (
    <>
      {/* Trigger */}
      <button onClick={() => setIsOpen(!isOpen)}>{trigger}</button>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Menu */}
      <motion.nav
        initial="closed"
        animate={isOpen ? 'open' : 'closed'}
        variants={menuVariants}
        className="fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-50"
      >
        <div className="p-4">
          <motion.div
            initial="closed"
            animate={isOpen ? 'open' : 'closed'}
            transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
            className="space-y-2"
          >
            {items.map((item) => (
              <motion.div key={item.to} variants={itemVariants}>
                <Link
                  to={item.to}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-100 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  {item.icon}
                  <span className="text-gray-700">{item.label}</span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.nav>
    </>
  )
}
```

### Step 3: Create Floating Action Button with Animations

```tsx
// src/components/navigation/animated-fab.tsx
import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'

interface AnimatedFabProps {
  to: string
  label?: string
  icon?: React.ReactNode
  className?: string
}

export function AnimatedFab({
  to,
  label = 'Add',
  icon = <Plus className="w-6 h-6" />,
  className = '',
}: AnimatedFabProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={`fixed bottom-6 right-6 ${className}`}
    >
      <Link
        to={to}
        className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
      >
        <motion.div
          initial={{ rotate: 0 }}
          whileHover={{ rotate: 90 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          {icon}
        </motion.div>
        <span className="font-medium">{label}</span>
      </Link>
    </motion.div>
  )
}
```

---

## Advanced Animation Patterns

### Step 1: Shared Element Transitions

```tsx
// src/components/animations/shared-element.tsx
import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface SharedElementProps {
  layoutId: string
  children: ReactNode
  className?: string
}

export function SharedElement({
  layoutId,
  children,
  className,
}: SharedElementProps) {
  return (
    <motion.div
      layoutId={layoutId}
      className={className}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
    >
      {children}
    </motion.div>
  )
}

// Usage in post list
function PostCard({ post }: { post: Post }) {
  return (
    <Link to="/posts/$postId" params={{ postId: post.id }}>
      <SharedElement layoutId={`post-${post.id}`}>
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold">{post.title}</h2>
          <p className="text-gray-600">{post.excerpt}</p>
        </div>
      </SharedElement>
    </Link>
  )
}

// Usage in post detail
function PostDetail({ post }: { post: Post }) {
  return (
    <SharedElement layoutId={`post-${post.id}`}>
      <div className="border rounded-lg p-6">
        <h1 className="text-3xl font-bold">{post.title}</h1>
        <div className="prose mt-4">{post.content}</div>
      </div>
    </SharedElement>
  )
}
```

### Step 2: Route-Based Animation Variants

```tsx
// src/components/animations/route-variants.tsx
import { motion } from 'framer-motion'
import { useRouter } from '@tanstack/react-router'
import { ReactNode } from 'react'

interface RouteVariantsProps {
  children: ReactNode
}

export function RouteVariants({ children }: RouteVariantsProps) {
  const router = useRouter()
  const currentPath = router.state.location.pathname

  // Different animations based on route depth
  const getVariants = (path: string) => {
    const depth = path.split('/').length - 1

    if (depth === 1) {
      // Top-level routes slide from right
      return {
        initial: { opacity: 0, x: 100 },
        in: { opacity: 1, x: 0 },
        out: { opacity: 0, x: -100 },
      }
    } else if (depth === 2) {
      // Sub-routes slide up
      return {
        initial: { opacity: 0, y: 50 },
        in: { opacity: 1, y: 0 },
        out: { opacity: 0, y: -50 },
      }
    } else {
      // Deep routes fade
      return {
        initial: { opacity: 0 },
        in: { opacity: 1 },
        out: { opacity: 0 },
      }
    }
  }

  return (
    <motion.div
      key={currentPath}
      initial="initial"
      animate="in"
      exit="out"
      variants={getVariants(currentPath)}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
    >
      {children}
    </motion.div>
  )
}
```

### Step 3: Loading Animations

```tsx
// src/components/animations/loading-animation.tsx
import { motion } from 'framer-motion'

export function LoadingAnimation() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <motion.div
        className="flex space-x-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className="w-3 h-3 bg-blue-600 rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.8, 1],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: index * 0.2,
            }}
          />
        ))}
      </motion.div>
    </div>
  )
}

// Usage in routes with loading states
export const Route = createFileRoute('/posts/$postId')({
  component: PostPage,
  pendingComponent: LoadingAnimation,
})
```

---

## Complete Example

### App with Full Animation Integration

```tsx
// src/routes/posts/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { AnimatedRoute } from '@/components/animated-route'
import { AnimatedTabs } from '@/components/navigation/animated-tabs'
import { AnimatedFab } from '@/components/navigation/animated-fab'
import { SharedElement } from '@/components/animations/shared-element'

export const Route = createFileRoute('/posts/')({
  component: PostsPage,
})

const tabItems = [
  { to: '/posts', label: 'All Posts', exact: true },
  { to: '/posts/published', label: 'Published' },
  { to: '/posts/drafts', label: 'Drafts' },
]

function PostsPage() {
  const posts = [
    { id: '1', title: 'First Post', excerpt: 'This is the first post' },
    { id: '2', title: 'Second Post', excerpt: 'This is the second post' },
  ]

  return (
    <AnimatedRoute variant="slide">
      <div className="container mx-auto p-4">
        {/* Animated header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold mb-4">Posts</h1>
          <AnimatedTabs items={tabItems} />
        </motion.div>

        {/* Animated post grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid gap-4"
        >
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              whileHover={{ y: -2 }}
              className="cursor-pointer"
            >
              <SharedElement layoutId={`post-${post.id}`}>
                <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                  <h2 className="text-xl font-semibold">{post.title}</h2>
                  <p className="text-gray-600">{post.excerpt}</p>
                </div>
              </SharedElement>
            </motion.div>
          ))}
        </motion.div>

        {/* Floating action button */}
        <AnimatedFab to="/posts/new" label="New Post" />
      </div>
    </AnimatedRoute>
  )
}
```

---

## Common Problems

### Animations Not Triggering

**Problem:** Route animations don't work or appear choppy.

**Solutions:**

1. **Ensure proper key for AnimatePresence:**

   ```tsx
   <AnimatePresence mode="wait">
     <motion.div key={router.state.location.pathname}>
       <Outlet />
     </motion.div>
   </AnimatePresence>
   ```

2. **Use layout animations correctly:**

   ```tsx
   // ❌ This might cause layout shifts
   <motion.div animate={{ x: 100 }}>

   // ✅ Use layout for changing layouts
   <motion.div layout>
   ```

### Performance Issues

**Problem:** Animations cause performance problems or jank.

**Solutions:**

1. **Prefer transform and opacity animations:**

   ```tsx
   // ✅ GPU-accelerated properties
   const variants = {
     initial: { opacity: 0, scale: 0.95 },
     in: { opacity: 1, scale: 1 },
   }

   // ❌ Avoid animating layout properties
   const badVariants = {
     initial: { width: 0, height: 0 },
     in: { width: 'auto', height: 'auto' },
   }
   ```

2. **Use will-change CSS property sparingly:**
   ```tsx
   <motion.div style={{ willChange: 'transform' }} animate={{ x: 100 }} />
   ```

### Layout Shift Issues

**Problem:** Shared element transitions cause layout shifts.

**Solution:** Use layout animations and proper positioning:

```tsx
<motion.div
  layout
  layoutId="shared-element"
  style={{ position: 'relative' }}
  transition={{
    layout: { duration: 0.3 },
  }}
>
  {children}
</motion.div>
```

---

## Production Checklist

Before deploying your animated TanStack Router app:

### Performance

- [ ] Animations use GPU-accelerated properties (transform, opacity)
- [ ] No unnecessary will-change CSS properties
- [ ] Complex animations are conditional on user preferences
- [ ] Frame rate stays above 60fps on target devices

### User Experience

- [ ] Animations respect user's motion preferences
- [ ] Loading states have appropriate animations
- [ ] Navigation feels responsive and smooth
- [ ] Animations enhance rather than distract from content

### Accessibility

- [ ] Respect prefers-reduced-motion media query
- [ ] Animations don't interfere with screen readers
- [ ] Focus management works during transitions
- [ ] Essential content isn't hidden behind animations

### Technical

- [ ] Bundle size impact acceptable
- [ ] No animation-related console errors
- [ ] Smooth transitions on slower devices
- [ ] Proper cleanup of animation effects

---

## Related Resources

- [Framer Motion Documentation](https://www.framer.com/motion/) - Complete animation library guide
- [React Transition Group Migration](https://www.framer.com/motion/migrate-from-react-transition-group/) - Migration guide from other animation libraries
- [Animation Performance](https://web.dev/animations-guide/) - Web performance guide for animations
