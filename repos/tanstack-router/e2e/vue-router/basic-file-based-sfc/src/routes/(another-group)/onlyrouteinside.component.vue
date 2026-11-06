<script setup lang="ts">
import { useSearch, getRouteApi } from '@tanstack/vue-router'

const routeApi = getRouteApi('/(another-group)/onlyrouteinside')

const searchViaHook = useSearch({ from: '/(another-group)/onlyrouteinside' })
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
