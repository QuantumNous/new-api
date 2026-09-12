<script>
  let { name = 'Svelte' } = $props();
</script>

<main>
  <h1 id="title" class="bg-[#654321] px-4 py-2 text-white">
    Tailwind {name}
  </h1>
</main>
