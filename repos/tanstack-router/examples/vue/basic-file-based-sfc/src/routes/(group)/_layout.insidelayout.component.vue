<script setup lang="ts">
import { getRouteApi, useSearch } from '@tanstack/vue-router'

const routeApi = getRouteApi('/(group)/_layout/insidelayout')

const searchViaHook = useSearch({ from: '/(group)/_layout/insidelayout' })
const searchViaRouteHook = routeApi.useSearch()
const searchViaRouteApi = routeApi.useSearch()
</script>

<template>
  <div>
    <div data-testid="search-via-hook">{{ searchViaHook.hello }}</div>
    <div data-testid="search-via-route-hook">
      {{ searchViaRouteHook.hello }}
    </div>
    <div data-testid="search-via-route-api">{{ searchViaRouteApi.hello }}</div>
  </div>
</template>
