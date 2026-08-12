# How-To Guides

This directory contains focused, step-by-step instructions for common TanStack Router tasks. Each guide is designed to be:

- **Task-focused**: Covers one specific goal from start to finish
- **Self-contained**: All necessary steps included, no prerequisites assumed
- **Copy-paste ready**: Working code examples you can use immediately
- **Problem-solving oriented**: Addresses real-world scenarios and common issues

## Available Guides

- [Install TanStack Router](./install.md) - Basic installation steps
- [Use Environment Variables](./use-environment-variables.md) - Configure and use environment variables across different bundlers
- [Deploy to Production](./deploy-to-production.md) - Deploy your app to hosting platforms
- [Set Up Server-Side Rendering (SSR)](./setup-ssr.md) - Implement SSR with TanStack Router
- [Migrate from React Router v7](./migrate-from-react-router.md) - Complete migration guide from React Router v7

### Authentication

- [Set Up Basic Authentication](./setup-authentication.md) - Implement basic auth with React Context
- [Integrate Authentication Providers](./setup-auth-providers.md) - Use Auth0, Clerk, or Supabase
- [Set Up Role-Based Access Control](./setup-rbac.md) - Add permission-based routing

### Testing & Debugging

- [Set Up Testing with Code-Based Routing](./setup-testing.md) - Comprehensive testing setup for manually defined routes
- [Test File-Based Routing](./test-file-based-routing.md) - Specific patterns for testing file-based routing applications
- [Debug Router Issues](./debug-router-issues.md) - Troubleshoot common routing problems and performance issues

### UI Library Integration

- [Integrate with Shadcn/ui](./integrate-shadcn-ui.md) - Set up Shadcn/ui components with animations and styling
- [Integrate with Material-UI (MUI)](./integrate-material-ui.md) - Configure MUI components with proper theming and TypeScript
- [Integrate with Framer Motion](./integrate-framer-motion.md) - Add smooth animations and transitions to your routes
- [Integrate with Chakra UI](./integrate-chakra-ui.md) - Build responsive, accessible UIs with Chakra UI components

### Search Parameters & URL State (Progressive Series)

**Foundation Level (Start Here):**

- [x] [Set Up Basic Search Parameters](./setup-basic-search-params.md) - Create type-safe search validation and reading
- [x] [Navigate with Search Parameters](./navigate-with-search-params.md) - Update and manage search params with Links and navigation

**Intermediate Level (Common Patterns):**

- [x] [Validate Search Parameters with Schemas](./validate-search-params.md) - Use schema validation libraries for robust validation and type safety
- [x] [Work with Arrays, Objects, and Dates](./arrays-objects-dates-search-params.md) - Handle arrays, objects, dates, and nested data structures
- [x] [Share Search Parameters Across Routes](./share-search-params-across-routes.md) - Inherit and manage search params across route hierarchies

**Advanced Level (Power User Patterns):**

- [ ] Build Advanced Search Parameter Middleware - Create custom middleware for search param processing
- [ ] Optimize Search Parameter Performance - Minimize re-renders and improve performance with selectors
- [ ] Customize Search Parameter Serialization - Implement custom serialization for compression and compatibility

**Specialized Use Cases:**

- [ ] Build Search-Based Filtering Systems - Create complex filtering UIs with URL state
- [ ] Handle Search Parameters in Forms - Synchronize form state with URL search parameters
- [ ] Debug Search Parameter Issues - Troubleshoot common search param problems and performance issues
- [ ] Use Search Parameters with Data Loading - Integrate search params with loaders and data fetching

## Using These Guides

Each guide follows a consistent structure:

1. **Quick Start** - Brief overview of what you'll accomplish
2. **Step-by-step instructions** - Platform-specific or scenario-specific guidance
3. **Production checklist** - Verification steps (where applicable)
4. **Common problems** - Troubleshooting for typical issues
5. **Common next steps** - Optional related tasks you might want to tackle

## Contributing

When adding new how-to guides:

1. Focus on a single, well-defined task
2. Use clear headings and numbered steps
3. Include complete, working code examples
4. Address the most frequent problems at the end
5. Comment out "Common next steps" links until those guides are created
6. In "Related Resources", link to specific relevant resources, not generic documentation
