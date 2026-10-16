import { createApp } from 'vue';
import text from './App.vue' with { type: 'text' };
import Normal from './Normal.vue';

window.vueText = text;

createApp(Normal).mount('#root');
