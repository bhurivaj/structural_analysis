<script setup lang="ts">
import { useCanvasMode } from '@/composables/useCanvasMode'
import { useSettingsStore } from '@/stores/settingsStore'

const props = defineProps<{
  onPresetView: (v: 'top' | 'front' | 'side' | 'iso') => void
}>()

const { workplaneZ, setWorkplaneZ } = useCanvasMode()
const settings = useSettingsStore()

function onZInput(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(val)) setWorkplaneZ(settings.fromLength(val))
}
</script>

<template>
  <div data-testid="workplane-controls" class="flex flex-col gap-1">
    <!-- Work plane Z input -->
    <div class="flex items-center gap-1 bg-white rounded border border-slate-300 shadow-sm px-2 py-1">
      <span class="text-[10px] font-mono text-slate-500 select-none">Z:</span>
      <input
        type="number"
        step="0.1"
        :value="settings.toLength(workplaneZ)"
        class="w-14 text-xs font-mono text-slate-700 border-none outline-none bg-transparent"
        @change="onZInput"
      />
      <span class="text-[10px] font-mono text-slate-400 select-none">{{ settings.lengthUnit }}</span>
    </div>
    <!-- Preset view buttons -->
    <div class="flex gap-0.5 bg-white rounded border border-slate-300 shadow-sm p-0.5">
      <button
        v-for="v in (['top', 'front', 'side', 'iso'] as const)"
        :key="v"
        class="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded text-slate-600 hover:bg-slate-100 uppercase select-none"
        :title="v === 'top' ? 'Plan view (top)' : v === 'front' ? 'Front elevation' : v === 'side' ? 'Side elevation' : 'Isometric'"
        @click="props.onPresetView(v)"
      >{{ v }}</button>
    </div>
  </div>
</template>
