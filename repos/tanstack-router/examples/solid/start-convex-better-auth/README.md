### Guide

Rename .env.example to .env.local

Run

- `pnpm i`
- `pnpx convex dev`
- `pnpx convex env set SITE_URL http://localhost:3000/`
- `pnpx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)`
- `pnpx convex dev` - takes up one terminal

In a separate terminal run

- `pnpm run dev`
