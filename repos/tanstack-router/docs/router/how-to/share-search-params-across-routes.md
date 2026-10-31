---
title: Share Search Parameters Across Routes
---

# How to Share Search Parameters Across Routes

Search parameters automatically inherit from parent routes in TanStack Router. When a parent route validates search parameters, child routes can access them via `Route.useSearch()` alongside their own parameters.

## How Parameter Inheritance Works

TanStack Router automatically merges search parameters from parent routes with child route parameters. This happens through the route hierarchy:

1. **Parent route** validates shared parameters with `validateSearch`
2. **Child routes** automatically inherit those validated parameters
3. **`Route.useSearch()`** returns both local and inherited parameters

## Global Parameters via Root Route

Share parameters across your entire application by validating them in the root route:

```tsx
// routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { z } from 'zod'

const globalSearchSchema = z.object({
  theme: z.enum(['light', 'dark']).default('light'),
  lang: z.enum(['en', 'es', 'fr']).default('en'),
  debug: z.boolean().default(false),
})

export const Route = createRootRoute({
  validateSearch: globalSearchSchema,
  component: RootComponent,
})

function RootComponent() {
  const { theme, lang, debug } = Route.useSearch()

  return (
    <div className={`app theme-${theme} lang-${lang}`}>
      {debug && <DebugPanel />}
      <Outlet />
    </div>
  )
}
```

```tsx
// routes/products/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const productSearchSchema = z.object({
  page: z.number().default(1),
  category: z.string().default('all'),
})

export const Route = createFileRoute('/products/')({
  validateSearch: productSearchSchema,
  component: ProductsPage,
})

function ProductsPage() {
  // Contains both local (page, category) AND inherited (theme, lang, debug) parameters
  const search = Route.useSearch()

  return (
    <div>
      <h1>Products (Theme: {search.theme})</h1>
      <p>Page: {search.page}</p>
      <p>Category: {search.category}</p>
    </div>
  )
}
```

## Section-Specific Parameters via Layout Routes

Share parameters within a section of your app using layout routes:

```tsx
// routes/_authenticated.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { z } from 'zod'

const authSearchSchema = z.object({
  impersonate: z.string().optional(),
  sidebar: z.boolean().default(true),
  notifications: z.boolean().default(true),
})

export const Route = createFileRoute('/_authenticated')({
  validateSearch: authSearchSchema,
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const search = Route.useSearch()

  return (
    <div className="authenticated-layout">
      {search.sidebar && <Sidebar />}
      <main className="main-content">
        {search.notifications && <NotificationBar />}
        <Outlet />
      </main>
      {search.impersonate && <ImpersonationBanner user={search.impersonate} />}
    </div>
  )
}
```

```tsx
// routes/_authenticated/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  // Contains inherited auth parameters (impersonate, sidebar, notifications)
  const search = Route.useSearch()

  return (
    <div>
      <h1>Dashboard</h1>
      {search.impersonate && (
        <Alert>Currently impersonating: {search.impersonate}</Alert>
      )}
      <DashboardContent />
    </div>
  )
}
```

## Common Use Cases

**Global Application Settings:**

- Theme, language, timezone
- Debug flags, feature toggles
- Analytics tracking (UTM parameters)

**Section-Specific State:**

- Authentication context (user role, impersonation)
- Layout preferences (sidebar, density)
- Workspace or organization context

**Persistent UI State:**

- Modal visibility, drawer state
- Filter presets, view modes
- Accessibility preferences

## Common Problems

### Problem: Parameters Not Inheriting

**Cause**: Parent route not validating the shared parameters.

```tsx
// ❌ Root route missing validateSearch
export const Route = createRootRoute({
  component: RootComponent, // No validateSearch
})

// Child route can't access theme parameter
function ProductsPage() {
  const search = Route.useSearch() // No theme available
}
```

**Solution**: Add `validateSearch` to the parent route:

```tsx
// ✅ Root route validates shared parameters
export const Route = createRootRoute({
  validateSearch: globalSearchSchema,
  component: RootComponent,
})
```

### Problem: Navigation Loses Shared Parameters

**Cause**: Not preserving inherited parameters during navigation.

```tsx
// ❌ Navigation overwrites all search parameters
router.navigate({
  to: '/products',
  search: { page: 1 }, // Loses theme, lang, etc.
})
```

**Solution**: Preserve existing parameters with function syntax:

```tsx
// ✅ Preserve existing parameters
router.navigate({
  to: '/products',
  search: (prev) => ({ ...prev, page: 1 }),
})
```

### Problem: Type Errors with Inherited Parameters

**Cause**: Child route schema doesn't account for inherited parameters.

```tsx
// ❌ TypeScript error: Property 'theme' doesn't exist
const search = Route.useSearch()
console.log(search.theme) // Type error
```

**Solution**: TypeScript automatically infers inherited types when using `validateSearch`. No additional typing needed - the inheritance works automatically.

## Production Checklist

- [ ] **Clear ownership**: Document which route validates which shared parameters
- [ ] **Avoid conflicts**: Use distinct parameter names across route levels
- [ ] **Preserve on navigation**: Use function syntax to maintain inherited parameters
- [ ] **Minimal URLs**: Only include essential shared parameters
- [ ] **Graceful defaults**: Provide fallback values for all shared parameters

<!--
## Common Next Steps

After implementing shared search parameters, you might want to:

- [Build Advanced Search Parameter Middleware](./advanced-search-param-middleware.md) - Create reusable parameter sharing logic
- [Handle Search Parameters in Forms](./search-params-in-forms.md) - Integrate shared parameters with form state
- [Debug Search Parameter Issues](./debug-search-param-issues.md) - Troubleshoot parameter sharing problems
-->

## Related Resources

- [Set Up Basic Search Parameters](./setup-basic-search-params.md) - Learn search parameter fundamentals
- [Navigate with Search Parameters](./navigate-with-search-params.md) - Navigate while preserving search state
- [Validate Search Parameters with Schemas](./validate-search-params.md) - Add type safety to shared parameters
