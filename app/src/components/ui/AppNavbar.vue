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
  { to: '/help', label: 'Help' },
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
        class="px-3 py-1 rounded text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-1.5"
        title="Import/Export JSON"
        @click="showImport = true"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 shrink-0">
          <path fill-rule="evenodd" d="M2.24 6.8a.75.75 0 001.06-.04l1.95-2.1v8.59a.75.75 0 001.5 0V4.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0L2.2 5.74a.75.75 0 00.04 1.06zm8 6.4a.75.75 0 00-.04 1.06l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75a.75.75 0 00-1.5 0v8.59l-1.95-2.1a.75.75 0 00-1.06-.04z" clip-rule="evenodd" />
        </svg>
        Import
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
