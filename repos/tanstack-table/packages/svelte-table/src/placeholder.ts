import type { SvelteComponentDev } from 'svelte/internal'
import { create_ssr_component, escape } from 'svelte/internal'
import PlaceholderClient from './placeholder.svelte'

type X = typeof PlaceholderClient

const PlaceholderServer = create_ssr_component(
  ($$result: any, $$props: any, $$bindings: any, slots: any) => {
    return `${escape($$props.content)}`
  }
) as any as typeof SvelteComponentDev

export default typeof document === 'undefined'
  ? PlaceholderServer
  : PlaceholderClient
