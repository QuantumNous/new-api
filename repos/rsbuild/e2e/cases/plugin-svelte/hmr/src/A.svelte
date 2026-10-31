<script>
  import B from './test-temp-B.svelte';
  export let count = 0;
</script>

<main>
  <button
    id="A"
    on:click={() => {
      count += 1;
    }}
  >A: {count}</button>
  <B {count} />
</main>

<style>
  button {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }
</style>
