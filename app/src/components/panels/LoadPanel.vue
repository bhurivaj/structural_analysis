<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useLoadsStore } from '@/stores/loadsStore'
import { useStructureStore } from '@/stores/structureStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCanvasTool } from '@/composables/useCanvasTool'
import NumberInput from '@/components/ui/NumberInput.vue'
import type { LoadCaseCategory } from '@/types/loadCases'

const CASE_LABELS: Record<LoadCaseCategory, string> = { D: 'Dead (D)', L: 'Live (L)', W: 'Wind (W)', E: 'Seismic (E)', S: 'Snow (S)' }
const CASE_COLORS: Record<LoadCaseCategory, string> = { D: 'bg-slate-200 text-slate-700', L: 'bg-blue-100 text-blue-700', W: 'bg-sky-100 text-sky-700', E: 'bg-red-100 text-red-700', S: 'bg-violet-100 text-violet-700' }

const loads = useLoadsStore()
const structure = useStructureStore()
const settings = useSettingsStore()
const { activeTool, pendingLoadNodeId, pendingLoadMemberId, editingLoadId, setEditingLoad } = useCanvasTool()

const loadType = ref<'point_load' | 'distributed_load' | 'moment'>('point_load')
const targetNodeId = ref('')
const targetMemberId = ref('')
const fx = ref(0)
const fy = ref(-10)
const mz = ref(10)
const w1 = ref(-10)
const w2 = ref(-10)
const direction = ref<'local_y' | 'global_y'>('global_y')
const loadLabel = ref('')
const loadCase = ref<LoadCaseCategory>('D')

const selectedNodeId = computed(() => structure.selectedNodeIds[0] ?? '')
const selectedMemberId = computed(() => structure.selectedMemberIds[0] ?? '')

watch(
  () => structure.structureType,
  (type) => {
    if (type === 'truss' && loadType.value === 'moment') {
      loadType.value = 'point_load'
    }
  },
)

watch(activeTool, (tool) => {
  if (tool === 'ADD_POINT_LOAD') loadType.value = 'point_load'
  else if (tool === 'ADD_DIST_LOAD') loadType.value = 'distributed_load'
  else if (tool === 'ADD_MOMENT') loadType.value = 'moment'
}, { immediate: true })

watch(pendingLoadNodeId, (id) => {
  if (id) targetNodeId.value = id
})

watch(pendingLoadMemberId, (id) => {
  if (id) targetMemberId.value = id
})

watch(editingLoadId, (id) => {
  if (!id) return
  const load = loads.loads.find(l => l.id === id)
  if (!load) return
  loadLabel.value = load.label ?? ''
  if (load.type === 'point_load') {
    loadType.value = 'point_load'
    targetNodeId.value = load.nodeId
    fx.value = settings.toForce(load.fx)
    fy.value = settings.toForce(load.fy)
    loadCase.value = load.loadCase ?? 'D'
  } else if (load.type === 'distributed_load') {
    loadType.value = 'distributed_load'
    targetMemberId.value = load.memberId
    w1.value = settings.toForce(load.w1)
    w2.value = settings.toForce(load.w2)
    direction.value = load.direction
    loadCase.value = load.loadCase ?? 'D'
  } else {
    loadType.value = 'moment'
    targetNodeId.value = load.nodeId
    mz.value = settings.toForce(load.mz)
    loadCase.value = load.loadCase ?? 'D'
  }
})

function addLoad() {
  if (editingLoadId.value) {
    const id = editingLoadId.value
    const labelData = loadLabel.value ? { label: loadLabel.value } : {}
    if (loadType.value === 'point_load') {
      loads.updateLoad(id, { fx: settings.fromForce(fx.value), fy: settings.fromForce(fy.value), loadCase: loadCase.value, ...labelData })
    } else if (loadType.value === 'distributed_load') {
      loads.updateLoad(id, { w1: settings.fromForce(w1.value), w2: settings.fromForce(w2.value), direction: direction.value, loadCase: loadCase.value, ...labelData })
    } else {
      loads.updateLoad(id, { mz: settings.fromForce(mz.value), loadCase: loadCase.value, ...labelData })
    }
    setEditingLoad(null)
    return
  }
  if (loadType.value === 'point_load') {
    const nodeId = targetNodeId.value || selectedNodeId.value
    if (!nodeId) return
    loads.addPointLoad({ nodeId, fx: settings.fromForce(fx.value), fy: settings.fromForce(fy.value), loadCase: loadCase.value })
  } else if (loadType.value === 'distributed_load') {
    const memberId = targetMemberId.value || selectedMemberId.value
    if (!memberId) return
    loads.addDistributedLoad({ memberId, w1: settings.fromForce(w1.value), w2: settings.fromForce(w2.value), direction: direction.value, loadCase: loadCase.value })
  } else {
    const nodeId = targetNodeId.value || selectedNodeId.value
    if (!nodeId) return
    loads.addMomentLoad({ nodeId, mz: settings.fromForce(mz.value), loadCase: loadCase.value })
  }
}

function startEdit(loadId: string) {
  setEditingLoad(loadId)
}

function cancelEdit() {
  setEditingLoad(null)
  targetNodeId.value = ''
  targetMemberId.value = ''
}
</script>

<template>
  <div class="p-3 space-y-3">
    <div class="font-medium text-sm text-slate-700">Add Load</div>

    <label class="flex flex-col gap-0.5">
      <span class="text-xs text-slate-500">Type</span>
      <select v-model="loadType" class="px-2 py-1 text-sm border border-slate-300 rounded">
        <option value="point_load">Point Load</option>
        <option value="distributed_load">Distributed Load</option>
        <option value="moment" :disabled="structure.structureType === 'truss'" class="text-slate-400">Moment</option>
      </select>
    </label>
    <p v-if="structure.structureType === 'truss'" class="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
      Moment loads are not applicable to trusses (pin-jointed).
    </p>

    <label v-if="editingLoadId" class="flex flex-col gap-0.5">
      <span class="text-xs text-slate-500">Label</span>
      <input
        type="text"
        v-model="loadLabel"
        class="px-2 py-1 text-sm border border-slate-300 rounded font-medium"
        placeholder="e.g. PL1"
      />
    </label>

    <template v-if="loadType === 'point_load'">
      <label class="flex flex-col gap-0.5">
        <span class="text-xs text-slate-500">Node</span>
        <select v-model="targetNodeId" class="px-2 py-1 text-sm border border-slate-300 rounded">
          <option v-if="selectedNodeId" :value="selectedNodeId">(selected) {{ selectedNodeId.slice(0, 6) }}</option>
          <option v-for="n in structure.nodes" :key="n.id" :value="n.id">{{ n.label || n.id.slice(0, 6) }}</option>
        </select>
      </label>
      <NumberInput :label="`Fx`" :unit="settings.forceUnit" :step="1" :model-value="fx" @update:model-value="v => fx = v" />
      <NumberInput :label="`Fy`" :unit="settings.forceUnit" :step="1" :model-value="fy" @update:model-value="v => fy = v" />
    </template>

    <template v-else-if="loadType === 'distributed_load'">
      <label class="flex flex-col gap-0.5">
        <span class="text-xs text-slate-500">Member</span>
        <select v-model="targetMemberId" class="px-2 py-1 text-sm border border-slate-300 rounded">
          <option v-if="selectedMemberId" :value="selectedMemberId">(selected) {{ selectedMemberId.slice(0, 6) }}</option>
          <option v-for="m in structure.members" :key="m.id" :value="m.id">{{ m.label || m.id.slice(0, 6) }}</option>
        </select>
      </label>
      <NumberInput :label="`w₁ (start)`" :unit="settings.distForceLabel" :step="1" :model-value="w1" @update:model-value="v => w1 = v" />
      <NumberInput :label="`w₂ (end)`" :unit="settings.distForceLabel" :step="1" :model-value="w2" @update:model-value="v => w2 = v" />
      <label class="flex flex-col gap-0.5">
        <span class="text-xs text-slate-500">Direction</span>
        <select v-model="direction" class="px-2 py-1 text-sm border border-slate-300 rounded">
          <option value="global_y">Global Y</option>
          <option value="local_y">Local Y</option>
        </select>
      </label>
    </template>

    <template v-else>
      <label class="flex flex-col gap-0.5">
        <span class="text-xs text-slate-500">Node</span>
        <select v-model="targetNodeId" class="px-2 py-1 text-sm border border-slate-300 rounded">
          <option v-for="n in structure.nodes" :key="n.id" :value="n.id">{{ n.label || n.id.slice(0, 6) }}</option>
        </select>
      </label>
      <NumberInput :label="`Mz (+ CCW)`" :unit="settings.momentLabel" :step="1" :model-value="mz" @update:model-value="v => mz = v" />
    </template>

    <label class="flex flex-col gap-0.5">
      <span class="text-xs text-slate-500">Load Case</span>
      <select v-model="loadCase" class="px-2 py-1 text-sm border border-slate-300 rounded">
        <option v-for="(label, key) in CASE_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
    </label>

    <div class="flex gap-2">
      <button
        class="flex-1 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        @click="addLoad"
      >
        {{ editingLoadId ? 'Update Load' : 'Add Load' }}
      </button>
      <button
        v-if="editingLoadId"
        class="flex-1 py-1.5 text-sm bg-slate-400 text-white rounded hover:bg-slate-500"
        @click="cancelEdit"
      >
        Cancel
      </button>
    </div>

    <div class="border-t border-slate-100 pt-2 space-y-1 max-h-48 overflow-y-auto">
      <div
        v-for="load in loads.loads"
        :key="load.id"
        class="flex items-center justify-between text-xs text-slate-600 rounded px-2 py-1 cursor-pointer"
        :class="editingLoadId === load.id ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 hover:bg-slate-100'"
        @click="startEdit(load.id)"
      >
        <span class="flex items-center gap-1.5 min-w-0">
          <span
            class="shrink-0 px-1 rounded text-[10px] font-bold leading-4"
            :class="CASE_COLORS[(load as any).loadCase ?? 'D']"
          >{{ (load as any).loadCase ?? 'D' }}</span>
          <span class="truncate">{{ (load as any).label ?? (load.type === 'point_load' ? `PL @ ${(load as any).nodeId.slice(0, 4)}` : load.type === 'distributed_load' ? `DL @ ${(load as any).memberId?.slice(0, 4)}` : `ML @ ${(load as any).nodeId?.slice(0, 4)}`) }}</span>
        </span>
        <button class="text-red-500 hover:text-red-700 shrink-0" @click.stop="loads.deleteLoad(load.id)">×</button>
      </div>
    </div>
  </div>
</template>
