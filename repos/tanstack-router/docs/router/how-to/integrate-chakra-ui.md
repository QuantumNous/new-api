---
title: How to Integrate TanStack Router with Chakra UI
---

This guide covers setting up Chakra UI with TanStack Router, including theme configuration and creating responsive, accessible components.

## Quick Start

**Time Required:** 30-40 minutes  
**Difficulty:** Beginner to Intermediate  
**Prerequisites:** Existing TanStack Router project

### What You'll Accomplish

- Install and configure Chakra UI with TanStack Router
- Set up theme provider and custom theming
- Create type-safe router-compatible Chakra components
- Implement responsive navigation patterns
- Build accessible UI components with router integration

---

## Installation and Setup

### Step 1: Install Chakra UI Dependencies

```bash
npm install @chakra-ui/react @emotion/react @emotion/styled framer-motion
```

### Step 2: Set Up Chakra Provider

```tsx
// src/components/chakra-provider.tsx
import { ChakraProvider, extendTheme, type ThemeConfig } from '@chakra-ui/react'
import { ReactNode } from 'react'

// Extend the theme with custom colors and configurations
const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: true,
}

const theme = extendTheme({
  config,
  colors: {
    brand: {
      50: '#e3f2fd',
      100: '#bbdefb',
      200: '#90caf9',
      300: '#64b5f6',
      400: '#42a5f5',
      500: '#2196f3',
      600: '#1e88e5',
      700: '#1976d2',
      800: '#1565c0',
      900: '#0d47a1',
    },
  },
  fonts: {
    heading: 'Inter, sans-serif',
    body: 'Inter, sans-serif',
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
    Link: {
      baseStyle: {
        _hover: {
          textDecoration: 'none',
        },
      },
    },
  },
})

interface ChakraAppProviderProps {
  children: ReactNode
}

export function ChakraAppProvider({ children }: ChakraAppProviderProps) {
  return <ChakraProvider theme={theme}>{children}</ChakraProvider>
}
```

### Step 3: Update Root Route

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { ChakraAppProvider } from '@/components/chakra-provider'

export const Route = createRootRoute({
  component: () => (
    <ChakraAppProvider>
      <Outlet />
      <TanStackRouterDevtools />
    </ChakraAppProvider>
  ),
})
```

---

## Creating Router-Compatible Components

### Step 1: Create Router-Compatible Chakra Components

```tsx
// src/components/ui/chakra-router-link.tsx
import { createLink } from '@tanstack/react-router'
import { Link as ChakraLink, Button, IconButton } from '@chakra-ui/react'
import { forwardRef } from 'react'

// Router-compatible Chakra Link
export const RouterLink = createLink(
  forwardRef<HTMLAnchorElement, any>((props, ref) => {
    return <ChakraLink ref={ref} {...props} />
  }),
)

// Router-compatible Chakra Button
export const RouterButton = createLink(
  forwardRef<HTMLButtonElement, any>((props, ref) => {
    return <Button ref={ref} as="button" {...props} />
  }),
)

// Router-compatible Chakra IconButton
export const RouterIconButton = createLink(
  forwardRef<HTMLButtonElement, any>((props, ref) => {
    return <IconButton ref={ref} as="button" {...props} />
  }),
)
```

### Step 2: Create Navigation Components

```tsx
// src/components/navigation/chakra-nav.tsx
import { useMatchRoute } from '@tanstack/react-router'
import {
  Box,
  Flex,
  HStack,
  IconButton,
  useDisclosure,
  useColorModeValue,
  Stack,
  Collapse,
} from '@chakra-ui/react'
import { HamburgerIcon, CloseIcon } from '@chakra-ui/icons'
import { RouterLink } from '@/components/ui/chakra-router-link'

interface NavItem {
  label: string
  to: string
  exact?: boolean
}

interface ChakraNavProps {
  items: NavItem[]
  brand?: string
  brandTo?: string
}

export function ChakraNav({
  items,
  brand = 'Logo',
  brandTo = '/',
}: ChakraNavProps) {
  const { isOpen, onToggle } = useDisclosure()
  const matchRoute = useMatchRoute()

  return (
    <Box>
      <Flex
        bg={useColorModeValue('white', 'gray.800')}
        color={useColorModeValue('gray.600', 'white')}
        minH="60px"
        py={{ base: 2 }}
        px={{ base: 4 }}
        borderBottom={1}
        borderStyle="solid"
        borderColor={useColorModeValue('gray.200', 'gray.900')}
        align="center"
      >
        <Flex
          flex={{ base: 1, md: 'auto' }}
          ml={{ base: -2 }}
          display={{ base: 'flex', md: 'none' }}
        >
          <IconButton
            onClick={onToggle}
            icon={
              isOpen ? <CloseIcon w={3} h={3} /> : <HamburgerIcon w={5} h={5} />
            }
            variant="ghost"
            aria-label="Toggle Navigation"
          />
        </Flex>

        <Flex flex={{ base: 1 }} justify={{ base: 'center', md: 'start' }}>
          <RouterLink
            to={brandTo}
            fontFamily="heading"
            fontWeight="bold"
            fontSize="xl"
            color={useColorModeValue('gray.800', 'white')}
          >
            {brand}
          </RouterLink>

          <Flex display={{ base: 'none', md: 'flex' }} ml={10}>
            <DesktopNav items={items} />
          </Flex>
        </Flex>
      </Flex>

      <Collapse in={isOpen} animateOpacity>
        <MobileNav items={items} />
      </Collapse>
    </Box>
  )
}

function DesktopNav({ items }: { items: NavItem[] }) {
  const matchRoute = useMatchRoute()
  const linkColor = useColorModeValue('gray.600', 'gray.200')
  const linkHoverColor = useColorModeValue('gray.800', 'white')

  return (
    <HStack spacing={4}>
      {items.map((item) => {
        const isActive = matchRoute({ to: item.to, fuzzy: !item.exact })

        return (
          <RouterLink
            key={item.to}
            to={item.to}
            p={2}
            fontSize="sm"
            fontWeight={isActive ? 'bold' : 'medium'}
            color={isActive ? 'brand.500' : linkColor}
            _hover={{
              textDecoration: 'none',
              color: linkHoverColor,
            }}
          >
            {item.label}
          </RouterLink>
        )
      })}
    </HStack>
  )
}

function MobileNav({ items }: { items: NavItem[] }) {
  const matchRoute = useMatchRoute()

  return (
    <Stack
      bg={useColorModeValue('white', 'gray.800')}
      p={4}
      display={{ md: 'none' }}
    >
      {items.map((item) => {
        const isActive = matchRoute({ to: item.to, fuzzy: !item.exact })

        return (
          <RouterLink
            key={item.to}
            to={item.to}
            py={2}
            fontWeight={isActive ? 'bold' : 'medium'}
            color={
              isActive ? 'brand.500' : useColorModeValue('gray.600', 'gray.200')
            }
            _hover={{
              textDecoration: 'none',
            }}
          >
            {item.label}
          </RouterLink>
        )
      })}
    </Stack>
  )
}
```

### Step 3: Create Breadcrumb Navigation

```tsx
// src/components/navigation/chakra-breadcrumb.tsx
import { useRouter } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from '@chakra-ui/react'
import { ChevronRightIcon } from '@chakra-ui/icons'
import { RouterLink } from '@/components/ui/chakra-router-link'

interface BreadcrumbConfig {
  [key: string]: string
}

interface ChakraBreadcrumbProps {
  config?: BreadcrumbConfig
  separator?: React.ReactElement
}

export function ChakraBreadcrumb({
  config = {},
  separator = <ChevronRightIcon color="gray.500" />,
}: ChakraBreadcrumbProps) {
  const router = useRouter()
  const pathSegments = router.state.location.pathname.split('/').filter(Boolean)

  if (pathSegments.length === 0) return null

  const breadcrumbItems = pathSegments.map((segment, index) => {
    const path = '/' + pathSegments.slice(0, index + 1).join('/')
    const label =
      config[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
    const isLast = index === pathSegments.length - 1

    return {
      path,
      label,
      isLast,
    }
  })

  return (
    <Breadcrumb spacing="8px" separator={separator}>
      <BreadcrumbItem>
        <BreadcrumbLink as={RouterLink} to="/">
          Home
        </BreadcrumbLink>
      </BreadcrumbItem>

      {breadcrumbItems.map(({ path, label, isLast }) => (
        <BreadcrumbItem key={path} isCurrentPage={isLast}>
          <BreadcrumbLink
            as={isLast ? 'span' : RouterLink}
            to={isLast ? undefined : path}
            color={isLast ? 'gray.500' : undefined}
          >
            {label}
          </BreadcrumbLink>
        </BreadcrumbItem>
      ))}
    </Breadcrumb>
  )
}
```

---

## Responsive Design Patterns

### Step 1: Create Responsive Layout Component

```tsx
// src/components/layout/chakra-layout.tsx
import { ReactNode } from 'react'
import {
  Box,
  Container,
  Flex,
  useColorModeValue,
  VStack,
  useBreakpointValue,
} from '@chakra-ui/react'
import { ChakraNav } from '@/components/navigation/chakra-nav'
import { ChakraBreadcrumb } from '@/components/navigation/chakra-breadcrumb'

interface ChakraLayoutProps {
  children: ReactNode
  showBreadcrumb?: boolean
  maxWidth?: string
}

const navItems = [
  { label: 'Home', to: '/', exact: true },
  { label: 'Posts', to: '/posts' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

export function ChakraLayout({
  children,
  showBreadcrumb = true,
  maxWidth = 'container.xl',
}: ChakraLayoutProps) {
  const containerPadding = useBreakpointValue({ base: 4, md: 6 })

  return (
    <Box minH="100vh" bg={useColorModeValue('gray.50', 'gray.900')}>
      <ChakraNav items={navItems} brand="My App" />

      <Container maxW={maxWidth} py={containerPadding}>
        {showBreadcrumb && (
          <Box mb={6}>
            <ChakraBreadcrumb />
          </Box>
        )}

        <Box>{children}</Box>
      </Container>
    </Box>
  )
}
```

### Step 2: Create Responsive Card Grid

```tsx
// src/components/ui/chakra-card-grid.tsx
import { ReactNode } from 'react'
import { SimpleGrid, Box, useBreakpointValue } from '@chakra-ui/react'

interface ChakraCardGridProps {
  children: ReactNode
  minChildWidth?: string
  spacing?: number
}

export function ChakraCardGrid({
  children,
  minChildWidth = '300px',
  spacing = 6,
}: ChakraCardGridProps) {
  const columns = useBreakpointValue({
    base: 1,
    md: 2,
    lg: 3,
    xl: 4,
  })

  return (
    <SimpleGrid
      columns={columns}
      spacing={spacing}
      minChildWidth={minChildWidth}
    >
      {children}
    </SimpleGrid>
  )
}
```

---

## Complete Usage Examples

### Step 1: Posts List Page

```tsx
// src/routes/posts/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  Badge,
  VStack,
  HStack,
  useColorModeValue,
} from '@chakra-ui/react'
import { ChakraLayout } from '@/components/layout/chakra-layout'
import { ChakraCardGrid } from '@/components/ui/chakra-card-grid'
import { RouterLink, RouterButton } from '@/components/ui/chakra-router-link'

export const Route = createFileRoute('/posts/')({
  component: PostsPage,
})

function PostsPage() {
  const posts = [
    {
      id: '1',
      title: 'Getting Started with TanStack Router',
      excerpt: 'Learn how to build type-safe routing in React applications.',
      category: 'Tutorial',
      readTime: '5 min read',
    },
    {
      id: '2',
      title: 'Chakra UI Best Practices',
      excerpt: 'Tips and tricks for building beautiful UIs with Chakra UI.',
      category: 'Design',
      readTime: '8 min read',
    },
  ]

  return (
    <ChakraLayout>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading size="xl" mb={4}>
            Blog Posts
          </Heading>
          <Text color={useColorModeValue('gray.600', 'gray.400')}>
            Discover our latest articles and tutorials
          </Text>
        </Box>

        <Box>
          <RouterButton colorScheme="brand" mb={6}>
            Create New Post
          </RouterButton>

          <ChakraCardGrid>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </ChakraCardGrid>
        </Box>
      </VStack>
    </ChakraLayout>
  )
}

function PostCard({ post }: { post: any }) {
  const cardBg = useColorModeValue('white', 'gray.800')
  const cardBorder = useColorModeValue('gray.200', 'gray.700')

  return (
    <Card
      bg={cardBg}
      borderColor={cardBorder}
      borderWidth="1px"
      _hover={{
        shadow: 'lg',
        transform: 'translateY(-2px)',
        transition: 'all 0.2s',
      }}
    >
      <CardHeader pb={3}>
        <HStack justify="space-between" align="start">
          <Badge colorScheme="brand" variant="subtle">
            {post.category}
          </Badge>
          <Text fontSize="sm" color="gray.500">
            {post.readTime}
          </Text>
        </HStack>
      </CardHeader>

      <CardBody pt={0}>
        <VStack align="start" spacing={3}>
          <RouterLink to="/posts/$postId" params={{ postId: post.id }}>
            <Heading size="md" _hover={{ color: 'brand.500' }}>
              {post.title}
            </Heading>
          </RouterLink>

          <Text color={useColorModeValue('gray.600', 'gray.400')}>
            {post.excerpt}
          </Text>

          <RouterButton
            to="/posts/$postId"
            params={{ postId: post.id }}
            variant="ghost"
            colorScheme="brand"
            size="sm"
            alignSelf="flex-start"
          >
            Read More →
          </RouterButton>
        </VStack>
      </CardBody>
    </Card>
  )
}
```

### Step 2: Post Detail Page

```tsx
// src/routes/posts/$postId.tsx
import { createFileRoute } from '@tanstack/react-router'
import {
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  useColorModeValue,
  Divider,
  Tag,
  TagLabel,
} from '@chakra-ui/react'
import { ArrowBackIcon, EditIcon, DeleteIcon } from '@chakra-ui/icons'
import { ChakraLayout } from '@/components/layout/chakra-layout'
import { RouterButton, RouterLink } from '@/components/ui/chakra-router-link'

export const Route = createFileRoute('/posts/$postId')({
  component: PostPage,
})

function PostPage() {
  const { postId } = Route.useParams()
  const textColor = useColorModeValue('gray.600', 'gray.300')

  return (
    <ChakraLayout>
      <VStack spacing={8} align="stretch">
        {/* Back Navigation */}
        <Box>
          <RouterLink
            to="/posts"
            color="brand.500"
            _hover={{ textDecoration: 'none' }}
          >
            <HStack spacing={2}>
              <ArrowBackIcon />
              <Text>Back to Posts</Text>
            </HStack>
          </RouterLink>
        </Box>

        {/* Post Header */}
        <VStack spacing={4} align="start">
          <Heading size="2xl">Understanding TanStack Router</Heading>

          <HStack spacing={3}>
            <Tag colorScheme="brand">
              <TagLabel>Tutorial</TagLabel>
            </Tag>
            <Text color={textColor}>March 15, 2024</Text>
            <Text color={textColor}>•</Text>
            <Text color={textColor}>5 min read</Text>
          </HStack>

          <Divider />
        </VStack>

        {/* Post Content */}
        <Box>
          <VStack spacing={4} align="start">
            <Text color={textColor} lineHeight="tall">
              This is the detailed content of post {postId}. In this
              comprehensive guide, we'll explore how to integrate TanStack
              Router with Chakra UI to create beautiful, accessible, and
              responsive web applications.
            </Text>

            <Text color={textColor} lineHeight="tall">
              Chakra UI provides a simple, modular, and accessible component
              library that gives you the building blocks you need to build React
              applications with speed.
            </Text>
          </VStack>
        </Box>

        {/* Action Buttons */}
        <HStack spacing={4}>
          <RouterButton
            to="/posts/$postId/edit"
            params={{ postId }}
            leftIcon={<EditIcon />}
            colorScheme="brand"
            variant="outline"
          >
            Edit Post
          </RouterButton>

          <Button leftIcon={<DeleteIcon />} colorScheme="red" variant="outline">
            Delete Post
          </Button>
        </HStack>
      </VStack>
    </ChakraLayout>
  )
}
```

---

## Common Problems

### Theme Provider Issues

**Problem:** Chakra theme not applying correctly across routes.

**Solution:** Ensure ChakraProvider wraps the entire app at the root level:

```tsx
// ❌ Don't put provider inside individual routes
export const Route = createFileRoute('/some-route')({
  component: () => (
    <ChakraProvider>
      <SomeComponent />
    </ChakraProvider>
  ),
})

// ✅ Put provider at root level
export const Route = createRootRoute({
  component: () => (
    <ChakraProvider>
      <Outlet />
    </ChakraProvider>
  ),
})
```

### TypeScript Errors with Router Integration

**Problem:** TypeScript errors when using Chakra components with TanStack Router.

**Solution:** Use proper typing with `createLink`:

```tsx
import { createLink } from '@tanstack/react-router'
import { Button, type ButtonProps } from '@chakra-ui/react'
import { forwardRef } from 'react'

// Properly typed router button
export const RouterButton = createLink(
  forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
    return <Button ref={ref} as="button" {...props} />
  }),
)
```

### Color Mode Persistence

**Problem:** Color mode doesn't persist across route changes.

**Solution:** Set up proper color mode manager:

```tsx
import { ColorModeScript } from '@chakra-ui/react'

// Add to your index.html head
;<ColorModeScript initialColorMode={theme.config.initialColorMode} />

// Or use localStorage manager
import { localStorageManager } from '@chakra-ui/react'
;<ChakraProvider theme={theme} colorModeManager={localStorageManager}>
  {children}
</ChakraProvider>
```

### Responsive Design Issues

**Problem:** Responsive breakpoints not working correctly.

**Solution:** Use Chakra's responsive utilities properly:

```tsx
// ✅ Use breakpoint values correctly
const columns = useBreakpointValue({
  base: 1,
  md: 2,
  lg: 3,
  xl: 4,
})

// ✅ Or use responsive props
<Box
  display={{ base: 'block', md: 'flex' }}
  flexDirection={{ base: 'column', md: 'row' }}
>
```

---

## Production Checklist

Before deploying your Chakra UI + TanStack Router app:

### Functionality

- [ ] All router-compatible components work correctly
- [ ] Navigation states properly reflected
- [ ] Theme persists across route changes
- [ ] TypeScript compilation successful

### Accessibility

- [ ] Keyboard navigation working
- [ ] Screen reader compatibility tested
- [ ] Color contrast meets WCAG standards
- [ ] Focus management working properly

### Performance

- [ ] Bundle size optimized
- [ ] Color mode switching performant
- [ ] No unnecessary re-renders
- [ ] Images and icons optimized

### Responsiveness

- [ ] Works on mobile devices
- [ ] Tablet layouts functional
- [ ] Desktop experience optimal
- [ ] Breakpoints working correctly

---

## Related Resources

- [Chakra UI Documentation](https://chakra-ui.com/getting-started) - Complete component library guide
- [Chakra UI Recipes](https://chakra-ui.com/community/recipes) - Common patterns and recipes
- [TanStack Router createLink API](../api/router#createlink) - API documentation for component integration
- [Emotion CSS-in-JS](https://emotion.sh/docs/introduction) - Styling library used by Chakra UI
