<script setup lang="ts">
import {
  Link,
  Outlet,
  HeadContent,
  useRouter,
  useCanGoBack,
  useRouterState,
} from '@tanstack/vue-router'
import { TanStackRouterDevtools } from '@tanstack/vue-router-devtools'

const router = useRouter()
const canGoBack = useCanGoBack()
// test useRouterState doesn't crash client side navigation
const _state = useRouterState()
</script>

<template>
  <HeadContent />
  <div class="flex gap-2 p-2 text-lg border-b">
    <button
      data-testid="back-button"
      :disabled="!canGoBack"
      @click="router.history.back()"
      :class="{ 'line-through': !canGoBack }"
    >
      Back
    </button>
    <Link
      to="/"
      :activeProps="{ class: 'font-bold' }"
      :activeOptions="{ exact: true }"
    >
      Home
    </Link>
    <Link to="/posts" :activeProps="{ class: 'font-bold' }">Posts</Link>
    <Link to="/layout-a" :activeProps="{ class: 'font-bold' }">Layout</Link>
    <Link
      to="/onlyrouteinside"
      data-testid="link-to-only-route-inside-group"
      :search="{ hello: 'world' }"
      :activeProps="{ class: 'font-bold' }"
    >
      Only Route Inside Group
    </Link>
    <Link
      to="/inside"
      data-testid="link-to-route-inside-group"
      :search="{ hello: 'world' }"
      :activeProps="{ class: 'font-bold' }"
    >
      Inside Group
    </Link>
    <Link
      to="/subfolder/inside"
      data-testid="link-to-route-inside-group-inside-subfolder"
      :search="{ hello: 'world' }"
      :activeProps="{ class: 'font-bold' }"
    >
      Inside Subfolder Inside Group
    </Link>
    <Link
      to="/insidelayout"
      data-testid="link-to-route-inside-group-inside-layout"
      :search="{ hello: 'world' }"
      :activeProps="{ class: 'font-bold' }"
    >
      Inside Group Inside Layout
    </Link>
    <Link
      to="/lazyinside"
      data-testid="link-to-lazy-route-inside-group"
      :search="{ hello: 'world' }"
      :activeProps="{ class: 'font-bold' }"
    >
      Lazy Inside Group
    </Link>
    <Link to="/대한민국" :activeProps="{ class: 'font-bold' }"
      >unicode path</Link
    >
    <Link
      :activeProps="{ class: 'font-bold' }"
      :to="'/this-route-does-not-exist' as any"
    >
      This Route Does Not Exist
    </Link>
  </div>
  <hr />
  <Outlet />
  <TanStackRouterDevtools position="bottom-right" />
</template>
