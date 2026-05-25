<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { SceneManager } from './three/SceneManager'
import { StructureRenderer } from './three/StructureRenderer'
import { useStructureStore } from '@/stores/structureStore'
import { useSolverStore } from '@/stores/solverStore'
import { useThreeInteraction } from '@/composables/useThreeInteraction'
import { useCanvasTool } from '@/composables/useCanvasTool'

const containerRef = ref<HTMLDivElement | null>(null)
const cameraMode = ref<'2d' | '3d'>('2d')
let sceneMan: SceneManager | null = null
let structRend: StructureRenderer | null = null

const structure = useStructureStore()
const solver = useSolverStore()
const { activeTool } = useCanvasTool()
const { selectionRect, selectionMode, attach, detach } = useThreeInteraction()

const canvasCursor = computed(() => {
  if (activeTool.value === 'PAN') return 'grab'
  if (['ADD_NODE', 'ADD_MEMBER', 'ADD_POINT_LOAD', 'ADD_DIST_LOAD', 'ADD_MOMENT'].includes(activeTool.value)) return 'crosshair'
  return 'default'
})

const selectionOverlayStyle = computed(() => {
  if (!selectionRect.value) return {}
  const r = selectionRect.value
  const isWindow = selectionMode.value === 'window'
  return {
    position: 'absolute' as const,
    left: `${r.x}px`, top: `${r.y}px`,
    width: `${r.w}px`, height: `${r.h}px`,
    border: isWindow ? '1.5px solid #2563eb' : '1.5px dashed #22c55e',
    background: isWindow ? 'rgba(37,99,235,0.05)' : 'rgba(34,197,94,0.05)',
    pointerEvents: 'none' as const,
  }
})

function buildDeformedMap() {
  if (!solver.result?.success || !solver.showDeformed) return undefined
  const m = new Map<string, { ux: number; uy: number }>()
  for (const r of solver.result.nodeResults) m.set(r.nodeId, { ux: r.ux, uy: r.uy })
  return m
}

function updateScene() {
  structRend?.update(
    structure.nodes, structure.members,
    structure.selectedNodeIds, structure.selectedMemberIds,
    buildDeformedMap(), solver.deformedScale
  )
}

function toggleCameraMode() {
  const next = cameraMode.value === '2d' ? '3d' : '2d'
  cameraMode.value = next
  sceneMan?.setMode(next)
}

onMounted(() => {
  sceneMan = new SceneManager(containerRef.value!)
  structRend = new StructureRenderer(sceneMan.scene)
  attach(sceneMan, structRend, sceneMan.renderer.domElement)
  updateScene()
})

onUnmounted(() => {
  if (sceneMan) detach(sceneMan.renderer.domElement)
  structRend?.dispose()
  sceneMan?.dispose()
})

watch(
  [
    () => structure.nodes, () => structure.members,
    () => structure.selectedNodeIds, () => structure.selectedMemberIds,
    () => solver.result, () => solver.showDeformed, () => solver.deformedScale,
  ],
  updateScene, { deep: true }
)

function fitToView() {
  if (!sceneMan || !structure.nodes.length) return
  const xs = structure.nodes.map(n => n.x)
  const ys = structure.nodes.map(n => n.y)
  sceneMan.fitToView(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys))
}

function captureSnapshot() {
  return sceneMan?.snapshot() ?? ''
}

defineExpose({ captureSnapshot, fitToView })
</script>

<template>
  <div ref="containerRef" class="w-full h-full relative" :style="{ cursor: canvasCursor }">
    <div v-if="selectionRect" :style="selectionOverlayStyle" />
    <button
      class="absolute top-2 right-2 z-10 px-2.5 py-1 text-xs font-mono font-semibold rounded border shadow-sm transition-colors select-none"
      :class="cameraMode === '3d'
        ? 'bg-blue-600 text-white border-blue-700'
        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'"
      @click="toggleCameraMode"
      title="Toggle 2D / 3D camera"
    >
      {{ cameraMode === '2d' ? '2D' : '3D' }}
    </button>
  </div>
</template>
