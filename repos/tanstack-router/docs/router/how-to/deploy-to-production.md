---
title: How to Deploy TanStack Router to Production
---

This guide covers deploying TanStack Router applications to popular hosting platforms.

## Quick Start

Single Page Applications (SPAs) need special server configuration to handle client-side routing. Configure your hosting platform to serve `index.html` for all routes, allowing TanStack Router to handle navigation.

---

## Netlify Deployment

### 1. Create `_redirects` File

Create a `public/_redirects` file (or `_redirects` in your build output):

```
/*    /index.html   200
```

### 2. Alternative: `netlify.toml`

Create a `netlify.toml` file in your project root:

```toml
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build]
  publish = "dist"
  command = "npm run build"
```

### 3. For TanStack Start (SSR)

```toml
[build]
  publish = ".output/public"
  command = "npm run build"

[functions]
  directory = ".output/server"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/server"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## Cloudflare Pages

### 1. Create `_redirects` File

Create a `public/_redirects` file:

```
/*    /index.html   200
```

### 2. Alternative: `_routes.json`

Create a `public/_routes.json` file for more control:

```json
{
  "version": 1,
  "include": ["/*"],
  "exclude": ["/api/*"]
}
```

### 3. For TanStack Start (SSR)

Create `functions/_middleware.ts` for SSR support:

```ts
export const onRequest: PagesFunction = async (context) => {
  // Handle SSR requests
  return await handleSSR(context)
}
```

### 4. Deploy via Git

1. Connect your GitHub repository to Cloudflare Pages
2. Set build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** (leave empty)

### 5. Deploy via Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Deploy
wrangler pages publish dist --project-name=my-app
```

---

## Vercel Deployment

### 1. Create `vercel.json`

Create a `vercel.json` file in your project root:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2. For TanStack Start (SSR) Applications

If using TanStack Start with SSR, use this configuration instead:

```json
{
  "functions": {
    "app/server.ts": {
      "runtime": "nodejs18.x"
    }
  },
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api/server"
    }
  ]
}
```

### 3. Build Configuration

Ensure your `package.json` has the correct build script:

```json
{
  "scripts": {
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

### 4. Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

---

## GitHub Pages

### 1. Create `404.html`

GitHub Pages requires a `404.html` file that duplicates `index.html`:

```bash
# After building
cp dist/index.html dist/404.html
```

### 2. Update `vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  base: '/your-repo-name/', // Replace with your repository name
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
  build: {
    outDir: 'dist',
  },
})
```

### 3. GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Create 404.html
        run: cp dist/index.html dist/404.html

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## Firebase Hosting

### 1. Create `firebase.json`

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### 2. Deploy

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login and initialize
firebase login
firebase init hosting

# Build and deploy
npm run build
firebase deploy
```

---

## Apache Server

Create a `.htaccess` file in your build output directory:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## Nginx

Add this configuration to your Nginx server block:

```nginx
server {
  listen 80;
  server_name your-domain.com;
  root /path/to/your/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  # Optional: Cache static assets
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

---

## Docker Deployment

### 1. Create `Dockerfile`

```dockerfile
# Build stage
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 2. Create `nginx.conf`

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 3. Build and Run

```bash
docker build -t my-tanstack-app .
docker run -p 80:80 my-tanstack-app
```

---

## Production Checklist

Before deploying, ensure you have:

- [ ] Created hosting platform configuration file
- [ ] Set correct base path if deploying to subdirectory
- [ ] Configured environment variables with `VITE_` prefix
- [ ] Tested all routes by direct URL access
- [ ] Verified static assets load correctly

---

## Common Problems

### 404 Errors on Page Refresh

**Problem:** Routes work when navigating within the app, but refreshing the page shows 404.

**Cause:** The server looks for files like `/about/index.html` which don't exist in SPAs.

**Solution:** Add the configuration files shown above for your hosting platform.

### App Works Locally But Breaks When Deployed

**Problem:** App works in development but shows errors in production.

**Solutions:**

- **Subdirectory deployment:** Configure base path in `vite.config.js`:
  ```js
  export default defineConfig({
    base: '/my-app/', // Match your deployment path
  })
  ```
- **Build output mismatch:** Ensure build directory matches hosting config:
  ```js
  export default defineConfig({
    build: {
      outDir: 'dist', // Must match hosting platform setting
    },
  })
  ```
- **Environment variables:** Prefix with `VITE_` and rebuild:
  ```bash
  # .env
  VITE_API_URL=https://api.example.com
  ```

### Assets Not Loading (CSS/JS 404s)

**Problem:** App loads but styling is broken or JavaScript fails to load.

**Solutions:**

- Check build output directory in hosting configuration
- Verify public path configuration in Vite
- Ensure static file serving is properly configured

---

## Common Next Steps

After deployment, you might want to:

- [How to Set Up Basic Authentication](./setup-authentication.md) - Secure your application with auth
- [Migrate from React Router v7](./migrate-from-react-router.md) - Complete migration guide if you're coming from React Router
- [How to Set Up Server-Side Rendering (SSR)](./setup-ssr.md)

<!-- TODO: Uncomment as how-to guides are created
- [How to Optimize Performance](./optimize-performance.md)
- [How to Set Up Analytics](./setup-analytics.md)
-->

## Related Resources

- [Deployment Examples](https://github.com/TanStack/router/tree/main/examples) - Official examples
