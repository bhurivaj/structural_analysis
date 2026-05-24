<script setup lang="ts">
import type { SessionSnapshot } from '@/composables/useSessionCache'

defineProps<{
  session: SessionSnapshot | null
  savedAt: string
}>()

const emit = defineEmits<{
  resume: []
  startNew: []
}>()
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl shadow-2xl p-6 w-80">
        <h2 class="text-sm font-semibold text-slate-800 mb-1">Resume Previous Work?</h2>
        <p class="text-xs text-slate-500 mb-4">
          {{ session?.nodes.length }} nodes · {{ session?.members.length }} members · {{ session?.loads.length }} loads
          <br>
          <span class="text-slate-400">Saved {{ savedAt }}</span>
        </p>
        <div class="flex gap-2">
          <button
            class="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            @click="emit('resume')"
          >
            Continue
          </button>
          <button
            class="flex-1 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            @click="emit('startNew')"
          >
            Start New
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
