<main>
  <p>Current value: {value}</p>
  <button onclick={changeValue}>Change value</button>
</main>

<script lang="ts">
  let value = $state('Hello World');

  function changeValue() {
    value = 'Hello Svelte';
    console.log('test optional chaining', window?.value);
  }
</script>