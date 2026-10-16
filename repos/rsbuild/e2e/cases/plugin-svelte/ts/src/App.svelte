<script lang="ts">
  import { getCount } from './count.svelte';
  export let name: string;
</script>

<main>
  <h1 id="title">Hello {name}!</h1>
  <p id="count" >Count: {getCount()}</p>
</main>

<style>
  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }
</style>
