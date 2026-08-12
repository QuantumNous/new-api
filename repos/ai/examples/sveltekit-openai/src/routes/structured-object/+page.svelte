<script lang="ts">
  import ArrowUp from '$lib/components/icons/arrow-up.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Textarea } from '$lib/components/ui/textarea/index.js';
  import { Experimental_StructuredObject } from '@ai-sdk/svelte';
  import { notificationSchema } from './schema.js';
  import Trash from '$lib/components/icons/trash.svelte';

  const structuredObject = new Experimental_StructuredObject({
    api: '/api/structured-object',
    schema: notificationSchema,
  });
  let input = $state('');
  let userMessage = $state('');

  function handleSubmit(e: Event) {
    userMessage = input;
    e.preventDefault();
    structuredObject.submit(input);
    input = '';
  }
</script>

<main class="flex flex-col items-center h-dvh w-dvw">
  <div
    class="grid h-full w-full max-w-4xl grid-cols-1 grid-rows-[1fr,120px] p-2"
  >
    <div class="w-full h-full overflow-y-auto">
      {#if userMessage}
        <div
          class="my-2 max-w-[80%] justify-self-end rounded-md bg-secondary p-2 text-primary"
        >
          Me: {userMessage}
        </div>
      {/if}
      {#each structuredObject.object?.notifications ?? [] as notification, i (i)}
        <div class="my-2 max-w-[80%] rounded-md bg-primary p-2 text-secondary">
          {notification?.name}: {notification?.message}
        </div>
      {/each}
    </div>
    <form
      class="relative"
      onsubmit={e => {
        e.preventDefault();
        handleSubmit(e);
      }}
    >
      <Textarea
        bind:value={input}
        placeholder="Think of a theme to generate three notifications..."
        class="h-full"
        onkeydown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      <div class="absolute bottom-3 right-3">
        <Button
          aria-label="Clear"
          type="button"
          size="icon"
          onclick={() => structuredObject.clear()}
        >
          <Trash />
        </Button>
        <Button
          aria-label="Send message"
          disabled={structuredObject.loading}
          type="submit"
          size="icon"
        >
          <ArrowUp />
        </Button>
      </div>
    </form>
  </div>
</main>
