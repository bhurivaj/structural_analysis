<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import SettingsModal from './SettingsModal.vue'
import ImportModal from './ImportModal.vue'

const route = useRoute()
const showSettings = ref(false)
const showImport = ref(false)

const navItems = [
  { to: '/workspace', label: 'Workspace' },
  { to: '/profiles', label: 'Steel Profiles' },
  { to: '/analysis', label: 'Analysis' },
  { to: '/report', label: 'Report' },
]
</script>

<template>
  <nav class="h-12 bg-slate-800 flex items-center px-4 gap-1 shrink-0">
    <span class="text-white font-semibold text-sm mr-4 tracking-wide">StructCalc</span>
    <router-link
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="px-3 py-1 rounded text-sm transition-colors"
      :class="route.path === item.to
        ? 'bg-blue-600 text-white'
        : 'text-slate-300 hover:bg-slate-700 hover:text-white'"
    >
      {{ item.label }}
    </router-link>

    <div class="ml-auto flex gap-1">
      <button
        class="px-3 py-1 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        title="Import/Export JSON"
        @click="showImport = true"
      >
        ⬆⬇
      </button>
      <button
        class="px-3 py-1 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        title="Settings"
        @click="showSettings = true"
      >
        ⚙
      </button>
    </div>
  </nav>

  <SettingsModal v-model:open="showSettings" />
  <ImportModal v-if="showImport" @close="showImport = false" />
</template>
