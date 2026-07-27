<script setup lang="ts">
import { BRAND_LOGO_PATH } from '@/constants/branding'
</script>

<template>
  <img
    :src="BRAND_LOGO_PATH"
    alt=""
    aria-hidden="true"
    class="pencil-brand-frame shrink-0 object-contain"
  />
</template>
