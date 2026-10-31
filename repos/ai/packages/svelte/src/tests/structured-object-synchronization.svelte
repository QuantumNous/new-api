<script lang="ts" generics="RESULT">
  import type { FlexibleSchema } from '@ai-sdk/provider-utils';
  import { createAIContext } from '../context-provider.js';
  import { StructuredObject } from '../structured-object.svelte.js';

  let {
    id,
    api,
    schema,
  }: {
    id?: string;
    api: string;
    schema: FlexibleSchema<RESULT>;
  } = $props();

  createAIContext();
  const object1 = new StructuredObject({ id, api, schema });
  const object2 = new StructuredObject({ id, api, schema });

  export { object1, object2 };
</script>
