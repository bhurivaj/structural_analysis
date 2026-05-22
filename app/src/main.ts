import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { useSettingsStore } from './stores/settingsStore'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia).use(router)

const settings = useSettingsStore()
settings.load()

app.mount('#app')
