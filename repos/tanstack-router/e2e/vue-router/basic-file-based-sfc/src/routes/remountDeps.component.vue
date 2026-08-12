<script lang="ts">
import { ref } from 'vue'
// Module-scoped ref to persist across component remounts
const mounts = ref(0)
export { mounts }
</script>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSearch, useNavigate } from '@tanstack/vue-router'

const search = useSearch({ from: '/remountDeps' })
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
          to: '/remountDeps',
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
