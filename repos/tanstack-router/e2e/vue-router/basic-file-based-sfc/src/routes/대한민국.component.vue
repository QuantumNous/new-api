<script setup lang="ts">
import { Outlet } from '@tanstack/vue-router'
</script>

<template>
  <div>
    <h3 class="pb-2" data-testid="unicode-heading">Hello "/대한민국"!</h3>
    <hr />
    <Outlet />
  </div>
</template>
