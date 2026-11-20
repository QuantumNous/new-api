<script setup lang="ts">
import { useParams, getRouteApi } from '@tanstack/vue-router'

const api = getRouteApi('/posts_/$postId/edit')

const paramsViaApi = api.useParams()
const paramsViaHook = useParams({ from: '/posts_/$postId/edit' })
const paramsViaRouteHook = api.useParams()
</script>

<template>
  <div>
    <div data-testid="params-via-hook">{{ paramsViaHook.postId }}</div>
    <div data-testid="params-via-route-hook">
      {{ paramsViaRouteHook.postId }}
    </div>
    <div data-testid="params-via-route-api">{{ paramsViaApi.postId }}</div>
  </div>
</template>
