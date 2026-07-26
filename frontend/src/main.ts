import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import i18n from './i18n'
import router from './router'
import { useAppStore } from './stores'
import { migrateLegacyLocalStorage } from './utils/legacyStorage'
import './styles/index.css'

migrateLegacyLocalStorage()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(i18n)

void useAppStore(pinia).initialize()
router.isReady().then(() => app.mount('#app'))
