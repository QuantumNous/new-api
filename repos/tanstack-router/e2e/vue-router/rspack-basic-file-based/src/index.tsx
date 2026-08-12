import { createApp } from 'vue'
import App from './app'

const rootEl = document.getElementById('root')

if (!rootEl?.innerHTML) {
  createApp({
    setup() {
      return () => <App />
    },
  }).mount('#root')
}
