import { mount } from 'svelte';
import App from './A.svelte';

const app = mount(App, {
  target: document.body,
});

export default app;
