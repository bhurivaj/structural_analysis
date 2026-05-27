<script setup lang="ts">
import { computed } from 'vue'
import { useStructureStore } from '@/stores/structureStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCanvasMode } from '@/composables/useCanvasMode'
import type { SupportType, RollerAxis } from '@/types/structure'
import NumberInput from '@/components/ui/NumberInput.vue'

const structure = useStructureStore()
const settings = useSettingsStore()
const { cameraMode } = useCanvasMode()

const selectedNode = computed(() => {
  if (structure.selectedNodeIds.length !== 1) return null
  return structure.nodeById(structure.selectedNodeIds[0]) ?? null
})

function update(field: string, value: unknown) {
  if (!selectedNode.value) return
  structure.updateNode(selectedNode.value.id, { [field]: value })
}

function deleteNode() {
  if (!selectedNode.value) return
  structure.deleteNode(selectedNode.value.id)
}

const supportOptions: { value: SupportType; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'roller', label: 'Roller' },
  { value: 'fixed', label: 'Fixed' },
]
</script>

<template>
  <div v-if="selectedNode" class="p-3 space-y-3">
    <label class="flex flex-col gap-0.5">
      <span class="text-xs text-slate-500">Label</span>
      <input
        type="text"
        :value="selectedNode.label"
        class="px-2 py-1 text-sm border border-slate-300 rounded font-medium"
        @change="e => update('label', (e.target as HTMLInputElement).value.trim() || selectedNode!.label)"
      />
    </label>

    <NumberInput
      label="X"
      :unit="settings.lengthUnit"
      :model-value="settings.toLength(selectedNode.x)"
      @update:model-value="v => update('x', settings.fromLength(v))"
    />
    <NumberInput
      label="Y"
      :unit="settings.lengthUnit"
      :model-value="settings.toLength(selectedNode.y)"
      @update:model-value="v => update('y', settings.fromLength(v))"
    />
    <NumberInput
      v-if="cameraMode === '3d'"
      label="Z"
      :unit="settings.lengthUnit"
      :model-value="settings.toLength(selectedNode.z ?? 0)"
      @update:model-value="v => update('z', settings.fromLength(v))"
    />

    <label class="flex flex-col gap-0.5">
      <span class="text-xs text-slate-500">Support</span>
      <select
        :value="selectedNode.support"
        class="px-2 py-1 text-sm border border-slate-300 rounded"
        @change="e => update('support', (e.target as HTMLSelectElement).value as SupportType)"
      >
        <option v-for="opt in supportOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </label>

    <label v-if="selectedNode.support === 'roller'" class="flex flex-col gap-0.5">
      <span class="text-xs text-slate-500">Roller Direction</span>
      <select
        :value="selectedNode.rollerAxis ?? 'y'"
        class="px-2 py-1 text-sm border border-slate-300 rounded"
        @change="e => update('rollerAxis', (e.target as HTMLSelectElement).value as RollerAxis)"
      >
        <option value="y">Vertical (Y)</option>
        <option value="x">Horizontal (X)</option>
        <option value="z">Out-of-Plane (Z)</option>
      </select>
    </label>

    <button class="w-full py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200" @click="deleteNode">
      Delete Node
    </button>
  </div>

  <div v-else class="p-3 text-sm text-slate-400">
    No node selected.
  </div>
</template>
