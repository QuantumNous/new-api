<script setup lang="ts">
import { Link, Outlet } from '@tanstack/vue-router'
</script>

<template>
  <div>
    <div>I'm a nested layout</div>
    <div class="flex gap-2 border-b">
      <Link to="/layout-a" :activeProps="{ class: 'font-bold' }">
        Layout A
      </Link>
      <Link to="/layout-b" :activeProps="{ class: 'font-bold' }">
        Layout B
      </Link>
    </div>
    <div>
      <Outlet />
    </div>
  </div>
</template>
