<script lang="ts">
  import { page } from '$app/state';
  import ArrowUp from '$lib/components/icons/arrow-up.svelte';
  import Button from '$lib/components/ui/button/button.svelte';
  import { Textarea } from '$lib/components/ui/textarea/index.js';
  import { Chat } from '@ai-sdk/svelte';

  const chat = new Chat({
    id: page.params.id,
    // run client-side tools that are automatically executed:
    async onToolCall({ toolCall }) {
      // artificial 2 second delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (toolCall.toolName === 'getLocation') {
        const cities = ['New York', 'Los Angeles', 'Chicago', 'San Francisco'];
        const location = cities[Math.floor(Math.random() * cities.length)];

        await chat.addToolOutput({
          toolCallId: toolCall.toolCallId,
          tool: 'getLocation',
          output: location,
        });
      }
    },
  });

  const disabled = $derived(chat.status !== 'ready');

  function mapRoleToClass(role: string) {
    return role === 'assistant'
      ? 'bg-primary text-secondary rounded-md'
      : 'bg-secondary text-primary rounded-md justify-self-end';
  }

  let input = $state('');

  function handleSubmit(e: Event) {
    console.log('handleSubmit', e);
    console.log('input', input);
    e.preventDefault();
    chat.sendMessage({ text: input });
    input = '';
  }
</script>

<main class="flex flex-col items-center h-dvh w-dvw">
  <div
    class="grid h-full w-full max-w-4xl grid-cols-1 grid-rows-[1fr,120px] p-2"
  >
    <div class="overflow-y-auto w-full h-full">
      {#each chat.messages as message (message.id)}
        <div
          class="{mapRoleToClass(
            message.role,
          )} my-2 max-w-[80%] p-2 flex flex-col gap-2"
        >
          {#each message.parts as part, i (i)}
            {#if part.type === 'text'}
              {part.text}
            {:else if part.type === 'tool-askForConfirmation'}
              {#if part.state === 'input-available'}
                {@const input = part.input as { message: string }}
                <div class="flex flex-col gap-2">
                  {input.message}
                  <div class="flex gap-2">
                    <Button
                      variant="default"
                      onclick={() =>
                        chat.addToolOutput({
                          toolCallId: part.toolCallId,
                          tool: 'askForConfirmation',
                          output: 'Yes, confirmed',
                        })}>Yes</Button
                    >
                    <Button
                      variant="secondary"
                      onclick={() =>
                        chat.addToolOutput({
                          toolCallId: part.toolCallId,
                          tool: 'askForConfirmation',
                          output: 'No, denied',
                        })}>No</Button
                    >
                  </div>
                </div>
              {:else if part.state === 'output-available'}
                <div class="text-gray-500">
                  {part.output}
                </div>
              {/if}
            {:else if part.type === 'tool-getLocation'}
              {#if part.state === 'input-available'}
                <div class="text-gray-500">Getting location...</div>
              {:else if part.state === 'output-available'}
                <div class="text-gray-500">
                  Location: {part.output}
                </div>
              {/if}
            {:else if part.type === 'tool-getWeatherInformation'}
              {#if part.state === 'input-streaming'}
                <pre>{JSON.stringify(part, null, 2)}</pre>
              {:else if part.state === 'input-available'}
                {@const input = part.input as { city: string }}
                <div class="text-gray-500">
                  Getting weather information for {input.city}...
                </div>
              {:else if part.state === 'output-available'}
                {@const input = part.input as { city: string }}
                <div class="text-gray-500">
                  Weather in {input.city}: {part.output}
                </div>
              {/if}
            {/if}
          {/each}
        </div>
      {/each}
    </div>
    <form class="relative" onsubmit={handleSubmit}>
      <p>{chat.status}</p>
      <div>
        <a href="/chat/1">chat 1</a>
        <a href="/chat/2">chat 2</a>
        <a href="/chat/3">chat 3</a>
      </div>
      <Textarea
        bind:value={input}
        placeholder="Send a message..."
        class="h-full"
        onkeydown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit(event);
          }
        }}
      />
      <Button
        aria-label="Send message"
        {disabled}
        type="submit"
        size="icon"
        class="absolute right-3 bottom-3"
      >
        <ArrowUp />
      </Button>
    </form>
  </div>
</main>
