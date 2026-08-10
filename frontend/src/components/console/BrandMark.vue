<script setup lang="ts">
import { BRAND_LOGO_PATH } from '@/constants/branding'

const props = withDefaults(defineProps<{ src?: string }>(), {
  src: BRAND_LOGO_PATH,
})
</script>

<template>
  <img
    :src="props.src"
    alt=""
    aria-hidden="true"
    class="pencil-brand-frame shrink-0 object-contain"
  />
</template>
