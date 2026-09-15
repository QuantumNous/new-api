<script setup lang="ts">
import { Outlet } from '@tanstack/vue-router'
</script>

<template>
  <div>
    <div>Layout inside group</div>
    <Outlet />
  </div>
</template>
