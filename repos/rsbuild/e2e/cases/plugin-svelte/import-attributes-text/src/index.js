import { mount } from 'svelte';
import svelteText from './Text.svelte' with { type: 'text' };
import svelteTsText from './state.svelte.ts' with { type: 'text' };
import Normal from './Normal.svelte';

window.svelteText = svelteText;
window.svelteTsText = svelteTsText;

mount(Normal, {
  target: document.querySelector('#root'),
});
