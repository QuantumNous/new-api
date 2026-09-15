<script setup lang="ts">
import { useLoaderData } from '@tanstack/vue-router'
import type { PostType } from '../posts'

const post = useLoaderData({ from: '/posts/$postId' }) as unknown as PostType
</script>

<template>
  <div class="space-y-2">
    <h4 class="text-xl font-bold underline" data-testid="post-title">
      {{ post.title }}
    </h4>
    <div class="text-sm">{{ post.body }}</div>
  </div>
</template>
