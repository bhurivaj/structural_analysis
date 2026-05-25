<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import StructureCanvas from '@/components/canvas/StructureCanvas.vue'
import CanvasToolbar from '@/components/canvas/CanvasToolbar.vue'
import NodePanel from '@/components/panels/NodePanel.vue'
import MemberPanel from '@/components/panels/MemberPanel.vue'
import LoadPanel from '@/components/panels/LoadPanel.vue'
import LoadCombinationPanel from '@/components/panels/LoadCombinationPanel.vue'
import ResumeSessionDialog from '@/components/ui/ResumeSessionDialog.vue'
import { useStructureStore } from '@/stores/structureStore'
import { useLoadsStore } from '@/stores/loadsStore'
import { useSolverStore } from '@/stores/solverStore'
import { useLoadCasesStore } from '@/stores/loadCasesStore'
import { useCanvasViewport } from '@/composables/useCanvasViewport'
import { useSessionCache, type SessionSnapshot } from '@/composables/useSessionCache'
import { useUndoRedo } from '@/composables/useUndoRedo'
import { useCanvasTool } from '@/composables/useCanvasTool'
import type { StructureType } from '@/types/structure'

const structure = useStructureStore()
const loads = useLoadsStore()
const solver = useSolverStore()
const loadCases = useLoadCasesStore()
const { viewport } = useCanvasViewport()
const cache = useSessionCache()

const { canUndo, canRedo, undo, redo } = useUndoRedo()

const canvasRef = ref<InstanceType<typeof StructureCanvas> | null>(null)
const rightTab = ref<'node' | 'member' | 'load' | 'combo'>('node')
const showResumeDialog = ref(false)
const savedSession = ref<SessionSnapshot | null>(null)
const trussWarning = ref('')
const { activeTool, editingLoadId } = useCanvasTool()

const zoomPercent = computed(() => Math.round(viewport.value.k / 80 * 100))

const multiSelectActive = computed(() => {
  const nodeCount = structure.selectedNodeIds.length
  const memberCount = structure.selectedMemberIds.length
  // Only show generic panel for mixed or node-only multi-select.
  // When only members are multi-selected, let MemberPanel handle it.
  return nodeCount + memberCount > 1 && !(nodeCount === 0 && memberCount > 1)
})

function deleteSelection() {
  const nodeIds = [...structure.selectedNodeIds]
  const memberIds = [...structure.selectedMemberIds]
  nodeIds.forEach(id => structure.deleteNode(id))
  memberIds.forEach(id => structure.deleteMember(id))
  structure.clearSelection()
}

function handleStructureTypeChange(e: Event) {
  const type = (e.target as HTMLSelectElement).value as StructureType
  const removed = structure.setStructureType(type)
  if (removed > 0) {
    trussWarning.value = `Switched to Truss — ${removed} moment load${removed > 1 ? 's' : ''} removed (not applicable to pin-jointed trusses).`
    setTimeout(() => { trussWarning.value = '' }, 4000)
  }
}

function formatSavedAt(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString()
}

function handleResume() {
  cache.restoreSession()
  showResumeDialog.value = false
}

function handleStartNew() {
  structure.clearAll()
  loads.clearLoads()
  cache.clearSavedSession()
  showResumeDialog.value = false
}

onMounted(() => {
  const session = cache.getSavedSession()
  // Only prompt to resume on fresh start — skip if structure already loaded in memory.
  if (session && structure.nodes.length === 0) {
    savedSession.value = session
    showResumeDialog.value = true
  }
})

let saveTimer: ReturnType<typeof setTimeout>
watch(
  [() => structure.nodes, () => structure.members, () => structure.structureType, () => loads.loads],
  () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => cache.saveSession(), 800)
  },
  { deep: true },
)

watch(activeTool, (tool) => {
  if (['ADD_POINT_LOAD', 'ADD_DIST_LOAD', 'ADD_MOMENT'].includes(tool)) {
    rightTab.value = 'load'
  }
})

watch(() => structure.selectedNodeIds, (ids) => {
  if (ids.length > 0) rightTab.value = 'node'
}, { deep: true })

watch(() => structure.selectedMemberIds, (ids) => {
  if (ids.length > 0) rightTab.value = 'member'
}, { deep: true })

watch(editingLoadId, (id) => {
  if (id) rightTab.value = 'load'
})

watch(() => solver.result, (res) => {
  if (res?.success) {
    solver.snapshotDataUrl = canvasRef.value?.captureSnapshot() ?? ''
  }
})
</script>

<template>
  <ResumeSessionDialog
    v-if="showResumeDialog"
    :session="savedSession"
    :saved-at="savedSession ? formatSavedAt(savedSession.savedAt) : ''"
    @resume="handleResume"
    @start-new="handleStartNew"
  />

  <div class="flex h-full overflow-hidden">
    <!-- Left: toolbar -->
    <div class="flex flex-col items-center p-2 bg-slate-50 border-r border-slate-200 gap-2">
      <CanvasToolbar />

      <div class="border-t border-slate-200 w-full pt-2 space-y-1">
        <div class="text-xs text-slate-500 px-1">Type</div>
        <select
          :value="structure.structureType"
          class="w-full px-1 py-0.5 text-xs border border-slate-300 rounded"
          @change="handleStructureTypeChange"
        >
          <option value="frame">Frame</option>
          <option value="truss">Truss</option>
        </select>
      </div>

      <div class="mt-auto space-y-1 w-full">
        <div class="flex gap-1">
          <button
            :disabled="!canUndo"
            title="Undo (Ctrl+Z)"
            class="flex-1 py-1 text-xs rounded transition-colors flex items-center justify-center gap-1"
            :class="canUndo ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-50 text-slate-300 cursor-not-allowed'"
            @click="undo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5 shrink-0">
              <path fill-rule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.061.025z" clip-rule="evenodd" />
            </svg>
            Undo
          </button>
          <button
            :disabled="!canRedo"
            title="Redo (Ctrl+Shift+Z)"
            class="flex-1 py-1 text-xs rounded transition-colors flex items-center justify-center gap-1"
            :class="canRedo ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-slate-50 text-slate-300 cursor-not-allowed'"
            @click="redo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5 shrink-0">
              <path fill-rule="evenodd" d="M12.207 2.232a.75.75 0 00.025 1.06l4.146 3.958H6.375a5.375 5.375 0 000 10.75H9.25a.75.75 0 000-1.5H6.375a3.875 3.875 0 010-7.75h10.003l-4.146 3.957a.75.75 0 001.036 1.085l5.5-5.25a.75.75 0 000-1.085l-5.5-5.25a.75.75 0 00-1.061.025z" clip-rule="evenodd" />
            </svg>
            Redo
          </button>
        </div>
        <button
          title="Fit structure to view (F)"
          class="w-full py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
          @click="canvasRef?.fitToView()"
        >
          ⊡ Fit
        </button>
        <div class="text-[10px] text-slate-400 text-center truncate px-1" :title="loadCases.activeCombination.name">
          {{ loadCases.activeCombination.name }}
        </div>
        <button
          class="w-full py-1.5 text-xs font-medium rounded transition-colors"
          :class="solver.isRunning ? 'bg-slate-400 text-white cursor-wait' : 'bg-green-600 text-white hover:bg-green-700'"
          :disabled="solver.isRunning"
          @click="solver.runAnalysis()"
        >
          {{ solver.isRunning ? 'Solving…' : '▶ Run' }}
        </button>
        <button
          class="w-full py-1 text-xs font-medium rounded transition-colors"
          :class="solver.isRunningEnvelope ? 'bg-slate-400 text-white cursor-wait' : 'bg-indigo-500 text-white hover:bg-indigo-600'"
          :disabled="solver.isRunningEnvelope || solver.isRunning"
          @click="solver.runEnvelopeAnalysis()"
          title="Run all load combinations and find governing demands"
        >
          {{ solver.isRunningEnvelope ? 'Envelope…' : '⊛ Envelope' }}
        </button>
        <button
          class="w-full py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
          @click="solver.clearResult()"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Center: canvas -->
    <div class="flex-1 relative">
      <StructureCanvas ref="canvasRef" />

      <!-- Zoom indicator -->
      <div class="absolute bottom-2 right-2 text-xs text-slate-400 bg-white/80 backdrop-blur-sm px-1.5 py-0.5 rounded select-none pointer-events-none">
        {{ zoomPercent }}%
      </div>

      <!-- Pan hint -->
      <div class="absolute top-2 left-1/2 -translate-x-1/2 text-xs text-slate-400 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded select-none pointer-events-none">
        Scroll to zoom · Middle-drag or Space+drag to pan
      </div>

      <!-- Result error toast -->
      <div
        v-if="solver.result && !solver.result.success"
        class="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 text-xs px-3 py-2 rounded shadow"
      >
        {{ solver.result.error }}
      </div>

      <!-- Truss warning toast -->
      <div
        v-if="trussWarning"
        class="absolute bottom-16 left-1/2 -translate-x-1/2 bg-amber-100 border border-amber-400 text-amber-800 text-xs px-3 py-2 rounded shadow"
      >
        {{ trussWarning }}
      </div>

      <!-- Diagram overlay controls -->
      <div v-if="solver.result?.success" class="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border border-slate-200 rounded shadow px-2 py-1">
        <span class="text-xs text-slate-500 self-center mr-1">Diagram:</span>
        <button
          v-for="mode in (['N','V','M'] as const)"
          :key="mode"
          class="px-2 py-0.5 text-xs rounded transition-colors"
          :class="solver.diagramMode === mode ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
          @click="solver.setDiagramMode(solver.diagramMode === mode ? null : mode)"
        >{{ mode }}</button>
        <span class="border-l border-slate-200 mx-0.5 self-stretch"></span>
        <button
          class="px-2 py-0.5 text-xs rounded transition-colors"
          :class="solver.showDeformed ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
          @click="solver.toggleDeformed()"
        >DEF</button>
      </div>
    </div>

    <!-- Right: properties panel -->
    <div class="w-56 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      <div class="flex border-b border-slate-200 shrink-0">
        <button
          v-for="tab in [['node','Node'],['member','Member'],['load','Load'],['combo','Combo']] as const"
          :key="tab[0]"
          class="flex-1 py-1.5 text-xs transition-colors"
          :class="rightTab === tab[0] ? 'bg-white border-b-2 border-blue-600 text-blue-600' : 'bg-slate-50 text-slate-500 hover:text-slate-700'"
          @click="rightTab = tab[0]"
        >{{ tab[1] }}</button>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div v-if="multiSelectActive && rightTab !== 'combo'" class="p-3 space-y-3">
          <div class="font-medium text-sm text-slate-700">Selection</div>
          <div class="text-xs text-slate-500 space-y-0.5">
            <div v-if="structure.selectedNodeIds.length">{{ structure.selectedNodeIds.length }} node(s)</div>
            <div v-if="structure.selectedMemberIds.length">{{ structure.selectedMemberIds.length }} member(s)</div>
          </div>
          <button
            class="w-full py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
            @click="deleteSelection"
          >
            Delete Selected
          </button>
          <button
            class="w-full py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
            @click="structure.clearSelection()"
          >
            Clear Selection
          </button>
        </div>
        <template v-else>
          <NodePanel v-if="rightTab === 'node'" />
          <MemberPanel v-else-if="rightTab === 'member'" />
          <LoadCombinationPanel v-else-if="rightTab === 'combo'" />
          <LoadPanel v-else />
        </template>
      </div>
    </div>
  </div>
</template>
