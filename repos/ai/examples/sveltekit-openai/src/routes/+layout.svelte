<script lang="ts">
  import { createAIContext } from '@ai-sdk/svelte';
  import '../app.css';
  let { children } = $props();

  createAIContext();
</script>

{@render children()}
