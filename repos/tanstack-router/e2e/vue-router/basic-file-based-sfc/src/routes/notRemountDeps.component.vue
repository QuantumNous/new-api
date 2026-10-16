<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSearch, useNavigate } from '@tanstack/vue-router'

const mounts = ref(0)
const search = useSearch({ from: '/notRemountDeps' })
const navigate = useNavigate()

onMounted(() => {
  mounts.value++
})
</script>

<template>
  <div class="p-2">
    <button
      @click="
        navigate({
          to: '/notRemountDeps',
          search: { searchParam: Math.random().toString(36).substring(2, 8) },
        })
      "
    >
      Regenerate search param
    </button>

    <div>Search: {{ search.searchParam }}</div>
    <div data-testid="component-mounts">
      Page component mounts: {{ mounts }}
    </div>
  </div>
</template>
