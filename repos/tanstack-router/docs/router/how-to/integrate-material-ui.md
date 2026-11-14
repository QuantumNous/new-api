---
title: How to Integrate TanStack Router with Material-UI (MUI)
---

This guide covers setting up Material-UI with TanStack Router, including proper TypeScript integration and component composition patterns.

## Quick Start

**Time Required:** 45-60 minutes  
**Difficulty:** Intermediate  
**Prerequisites:** Existing TanStack Router project

### What You'll Accomplish

- Install and configure Material-UI with TanStack Router
- Set up proper theme provider integration
- Create type-safe router-compatible MUI components
- Implement navigation with active state indicators
- Resolve common TypeScript and styling issues

---

## Installation and Setup

### Step 1: Install Material-UI Dependencies

```bash
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material
```

**Optional: Add date picker support**

```bash
npm install @mui/x-date-pickers dayjs
```

### Step 2: Set Up Theme Provider

Create a theme provider that works with TanStack Router:

```tsx
// src/components/theme-provider.tsx
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { ReactNode } from 'react'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    // Customize components for router integration
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // More modern button styling
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          },
        },
      },
    },
  },
})

interface MuiThemeProviderProps {
  children: ReactNode
}

export function MuiThemeProvider({ children }: MuiThemeProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
```

### Step 3: Update Root Route

Wrap your application with the MUI theme provider:

```tsx
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { MuiThemeProvider } from '@/components/theme-provider'

export const Route = createRootRoute({
  component: () => (
    <MuiThemeProvider>
      <Outlet />
      <TanStackRouterDevtools />
    </MuiThemeProvider>
  ),
})
```

---

## Creating Router-Compatible MUI Components

### Step 1: Create Typed MUI Link Component

MUI Link components require special handling for TanStack Router's type system:

```tsx
// src/components/ui/mui-router-link.tsx
import { createLink } from '@tanstack/react-router'
import { Link as MuiLink, type LinkProps } from '@mui/material/Link'
import { forwardRef } from 'react'

// Create a router-compatible MUI Link with full type safety
export const RouterLink = createLink(
  forwardRef<HTMLAnchorElement, LinkProps>((props, ref) => {
    return <MuiLink ref={ref} {...props} />
  }),
)
```

### Step 2: Create Typed MUI Button Component

```tsx
// src/components/ui/mui-router-button.tsx
import { createLink } from '@tanstack/react-router'
import { Button, type ButtonProps } from '@mui/material/Button'
import { forwardRef } from 'react'

// Create a router-compatible MUI Button
export const RouterButton = createLink(
  forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
    return <Button ref={ref} component="button" {...props} />
  }),
)
```

### Step 3: Create Advanced Navigation Components

```tsx
// src/components/ui/mui-router-fab.tsx
import { createLink } from '@tanstack/react-router'
import { Fab, type FabProps } from '@mui/material/Fab'
import { forwardRef } from 'react'

// Router-compatible Floating Action Button
export const RouterFab = createLink(
  forwardRef<HTMLButtonElement, FabProps>((props, ref) => {
    return <Fab ref={ref} {...props} />
  }),
)
```

---

## Implementing Navigation with Active States

### Step 1: Create Navigation Tabs with Active States

```tsx
// src/components/navigation/mui-nav-tabs.tsx
import { useMatchRoute } from '@tanstack/react-router'
import { Tabs, Tab, type TabsProps } from '@mui/material'
import { RouterLink } from '@/components/ui/mui-router-link'

interface NavTab {
  label: string
  to: string
  value: string
  icon?: React.ReactNode
}

interface MuiNavTabsProps extends Omit<TabsProps, 'value' | 'onChange'> {
  tabs: NavTab[]
}

export function MuiNavTabs({ tabs, ...tabsProps }: MuiNavTabsProps) {
  const matchRoute = useMatchRoute()

  // Find active tab based on current route
  const activeTab =
    tabs.find((tab) => matchRoute({ to: tab.to, fuzzy: true }))?.value || false

  return (
    <Tabs value={activeTab} {...tabsProps}>
      {tabs.map((tab) => (
        <Tab
          key={tab.value}
          label={tab.label}
          value={tab.value}
          icon={tab.icon}
          component={RouterLink}
          to={tab.to}
          sx={{
            '&.Mui-selected': {
              fontWeight: 'bold',
            },
          }}
        />
      ))}
    </Tabs>
  )
}
```

### Step 2: Create Navigation Drawer

```tsx
// src/components/navigation/mui-nav-drawer.tsx
import { useMatchRoute } from '@tanstack/react-router'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  type DrawerProps,
} from '@mui/material'
import { RouterLink } from '@/components/ui/mui-router-link'

interface DrawerItem {
  label: string
  to: string
  icon?: React.ReactNode
}

interface MuiNavDrawerProps extends Omit<DrawerProps, 'children'> {
  items: DrawerItem[]
  title?: string
}

export function MuiNavDrawer({
  items,
  title,
  ...drawerProps
}: MuiNavDrawerProps) {
  const matchRoute = useMatchRoute()

  return (
    <Drawer {...drawerProps}>
      <Box sx={{ width: 250 }} role="presentation">
        {title && (
          <Typography
            variant="h6"
            sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}
          >
            {title}
          </Typography>
        )}

        <List>
          {items.map((item) => {
            const isActive = matchRoute({ to: item.to, fuzzy: true })

            return (
              <ListItem key={item.to} disablePadding>
                <ListItemButton
                  component={RouterLink}
                  to={item.to}
                  selected={isActive}
                  sx={{
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                    },
                  }}
                >
                  {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            )
          })}
        </List>
      </Box>
    </Drawer>
  )
}
```

### Step 3: Create App Bar with Navigation

```tsx
// src/components/navigation/mui-app-bar.tsx
import { useState } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Box,
} from '@mui/material'
import { Menu as MenuIcon, AccountCircle } from '@mui/icons-material'
import { RouterButton, RouterLink } from '@/components/ui/mui-router-link'
import { MuiNavDrawer } from './mui-nav-drawer'

interface AppBarItem {
  label: string
  to: string
  icon?: React.ReactNode
}

interface MuiAppBarProps {
  title: string
  navigationItems: AppBarItem[]
  userMenuItems?: AppBarItem[]
}

export function MuiAppBar({
  title,
  navigationItems,
  userMenuItems,
}: MuiAppBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null)

  const handleUserMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget)
  }

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null)
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setDrawerOpen(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            <RouterLink to="/" color="inherit" underline="none">
              {title}
            </RouterLink>
          </Typography>

          {/* Desktop Navigation */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, mr: 2 }}>
            {navigationItems.map((item) => (
              <RouterButton
                key={item.to}
                to={item.to}
                color="inherit"
                startIcon={item.icon}
                sx={{ ml: 1 }}
              >
                {item.label}
              </RouterButton>
            ))}
          </Box>

          {/* User Menu */}
          {userMenuItems && (
            <>
              <IconButton color="inherit" onClick={handleUserMenuClick}>
                <AccountCircle />
              </IconButton>
              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
              >
                {userMenuItems.map((item) => (
                  <MenuItem
                    key={item.to}
                    component={RouterLink}
                    to={item.to}
                    onClick={handleUserMenuClose}
                  >
                    {item.label}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Navigation Drawer */}
      <MuiNavDrawer
        items={navigationItems}
        title="Navigation"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  )
}
```

---

## Usage Examples

### Complete Page Example

```tsx
// src/routes/posts/$postId.tsx
import { createFileRoute } from '@tanstack/react-router'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
} from '@mui/material'
import { Edit, Delete, ArrowBack } from '@mui/icons-material'
import { RouterButton, RouterLink } from '@/components/ui/mui-router-link'

export const Route = createFileRoute('/posts/$postId')({
  component: PostPage,
})

function PostPage() {
  const { postId } = Route.useParams()

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* Breadcrumb Navigation */}
      <Box sx={{ mb: 3 }}>
        <RouterLink
          to="/posts"
          color="primary"
          sx={{ display: 'flex', alignItems: 'center', mb: 2 }}
        >
          <ArrowBack sx={{ mr: 1 }} />
          Back to Posts
        </RouterLink>
      </Box>

      {/* Post Content */}
      <Card>
        <CardContent>
          <Typography variant="h4" component="h1" gutterBottom>
            Post {postId}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip label="React" color="primary" size="small" />
            <Chip label="TypeScript" color="secondary" size="small" />
          </Stack>

          <Typography variant="body1" paragraph>
            This is the content of post {postId}. It demonstrates how
            Material-UI components work seamlessly with TanStack Router.
          </Typography>
        </CardContent>

        <CardActions>
          <RouterButton
            to="/posts/$postId/edit"
            params={{ postId }}
            variant="contained"
            startIcon={<Edit />}
            size="small"
          >
            Edit Post
          </RouterButton>

          <RouterButton
            to="/posts/$postId/delete"
            params={{ postId }}
            variant="outlined"
            color="error"
            startIcon={<Delete />}
            size="small"
          >
            Delete Post
          </RouterButton>
        </CardActions>
      </Card>
    </Container>
  )
}
```

### Layout with Navigation

```tsx
// src/routes/_layout.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Box } from '@mui/material'
import { Home, Article, Info, Contact } from '@mui/icons-material'
import { MuiAppBar } from '@/components/navigation/mui-app-bar'

export const Route = createFileRoute('/_layout')({
  component: LayoutComponent,
})

const navigationItems = [
  { label: 'Home', to: '/', icon: <Home /> },
  { label: 'Posts', to: '/posts', icon: <Article /> },
  { label: 'About', to: '/about', icon: <Info /> },
  { label: 'Contact', to: '/contact', icon: <Contact /> },
]

const userMenuItems = [
  { label: 'Profile', to: '/profile' },
  { label: 'Settings', to: '/settings' },
  { label: 'Logout', to: '/logout' },
]

function LayoutComponent() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <MuiAppBar
        title="My App"
        navigationItems={navigationItems}
        userMenuItems={userMenuItems}
      />

      <Box component="main" sx={{ mt: 2 }}>
        <Outlet />
      </Box>
    </Box>
  )
}
```

---

## Common Problems

### TypeScript Errors with Component Props

**Problem:** TypeScript errors when using MUI components with TanStack Router props.

**Solution:** Always use `createLink` for proper typing:

```tsx
// ❌ This will cause TypeScript errors
const BadButton = (props: any) => <Button {...props} />

// ✅ This provides full type safety
export const RouterButton = createLink(
  forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
    return <Button ref={ref} component="button" {...props} />
  }),
)
```

### Styling Conflicts

**Problem:** MUI styles conflict with other libraries or custom styles.

**Solutions:**

1. **Use MUI's emotion cache:**

   ```tsx
   import { CacheProvider } from '@emotion/react'
   import createCache from '@emotion/cache'

   const cache = createCache({
     key: 'mui',
     prepend: true,
   })

   export function App() {
     return (
       <CacheProvider value={cache}>
         <MuiThemeProvider>{/* Your app */}</MuiThemeProvider>
       </CacheProvider>
     )
   }
   ```

2. **Increase CSS specificity:**
   ```tsx
   const StyledButton = styled(Button)(({ theme }) => ({
     '&.router-active': {
       backgroundColor: theme.palette.primary.main,
       color: theme.palette.primary.contrastText,
     },
   }))
   ```

### Theme Not Applied Correctly

**Problem:** MUI theme changes don't apply to router-created components.

**Solution:** Ensure theme provider wraps the entire app:

```tsx
// ❌ Theme provider inside routes won't work for navigation
export const Route = createFileRoute('/some-route')({
  component: () => (
    <ThemeProvider theme={theme}>
      <SomeComponent />
    </ThemeProvider>
  ),
})

// ✅ Theme provider at root level
export const Route = createRootRoute({
  component: () => (
    <ThemeProvider theme={theme}>
      <Outlet />
    </ThemeProvider>
  ),
})
```

### Performance Issues with Large Apps

**Problem:** Bundle size or runtime performance issues.

**Solutions:**

1. **Use tree shaking:**

   ```tsx
   // ✅ Import only what you need
   import Button from '@mui/material/Button'
   import TextField from '@mui/material/TextField'

   // ❌ Avoid importing everything
   import { Button, TextField } from '@mui/material'
   ```

2. **Use dynamic imports for heavy components:**

   ```tsx
   import { lazy, Suspense } from 'react'
   import { CircularProgress } from '@mui/material'

   const DataGrid = lazy(() =>
     import('@mui/x-data-grid').then((module) => ({
       default: module.DataGrid,
     })),
   )

   function MyComponent() {
     return (
       <Suspense fallback={<CircularProgress />}>
         <DataGrid {...props} />
       </Suspense>
     )
   }
   ```

---

## Production Checklist

Before deploying your MUI + TanStack Router app:

### Functionality

- [ ] All navigation components work with router state
- [ ] Active states properly reflected in tabs and navigation
- [ ] TypeScript compilation successful
- [ ] All MUI components render correctly

### Performance

- [ ] Bundle size optimized with tree shaking
- [ ] Emotion CSS-in-JS performance acceptable
- [ ] No unnecessary re-renders on route changes
- [ ] Large components code-split appropriately

### Styling

- [ ] Theme consistency across all routes
- [ ] CSS conflicts resolved
- [ ] Responsive design working properly
- [ ] Dark mode integration (if applicable)

### Accessibility

- [ ] Keyboard navigation working
- [ ] Screen reader compatibility maintained
- [ ] Focus management across route transitions
- [ ] ARIA labels and roles properly set

---

## Related Resources

- [Material-UI with TypeScript](https://mui.com/material-ui/guides/typescript/) - Official MUI TypeScript guide
- [MUI Theming](https://mui.com/material-ui/customization/theming/) - Complete theming documentation
- [TanStack Router createLink API](../api/router#createlink) - API documentation for component integration
- [Emotion CSS-in-JS](https://emotion.sh/docs/introduction) - Styling library used by MUI
