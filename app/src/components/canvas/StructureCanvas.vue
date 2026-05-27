<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { SceneManager } from './three/SceneManager'
import { StructureRenderer } from './three/StructureRenderer'
import { GridRenderer } from './three/GridRenderer'
import { LoadsRenderer } from './three/LoadsRenderer'
import { SupportRenderer } from './three/SupportRenderer'
import WorkplaneControls from './WorkplaneControls.vue'
import { projectToScreen } from '@/composables/threeHitTest'
import { useStructureStore } from '@/stores/structureStore'
import { useSolverStore } from '@/stores/solverStore'
import { useLoadsStore } from '@/stores/loadsStore'
import { useThreeInteraction } from '@/composables/useThreeInteraction'
import { useCanvasTool } from '@/composables/useCanvasTool'
import { useCanvasMode } from '@/composables/useCanvasMode'
import { useCanvasViewport } from '@/composables/useCanvasViewport'

type LabelItem = { key: string; text: string; x: number; y: number }

const containerRef = ref<HTMLDivElement | null>(null)
const labels = ref<LabelItem[]>([])
const { cameraMode, setCameraMode, workplaneZ } = useCanvasMode()
const { viewport, setViewport } = useCanvasViewport()
let sceneMan: SceneManager | null = null
let structRend: StructureRenderer | null = null
let gridRend: GridRenderer | null = null
let loadsRend: LoadsRenderer | null = null
let suppRend: SupportRenderer | null = null

const structure = useStructureStore()
const solver = useSolverStore()
const loads = useLoadsStore()
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
  const m = new Map<string, { ux: number; uy: number; uz: number }>()
  for (const r of solver.result.nodeResults) m.set(r.nodeId, { ux: r.ux, uy: r.uy, uz: r.uz })
  return m
}

function updateScene() {
  structRend?.update(
    structure.nodes, structure.members,
    structure.selectedNodeIds, structure.selectedMemberIds,
    buildDeformedMap(), solver.deformedScale
  )
  loadsRend?.update(
    loads.pointLoads, loads.distributedLoads, loads.momentLoads,
    structure.nodes, structure.members
  )
  suppRend?.update(structure.nodes, cameraMode.value)
}

function updateLabels() {
  if (!sceneMan || !containerRef.value) return
  const cr = containerRef.value.getBoundingClientRect()
  const items: LabelItem[] = []
  for (const n of structure.nodes) {
    const { sx, sy } = projectToScreen(n.x, n.y, n.z ?? 0, sceneMan.camera, cr)
    items.push({ key: `n-${n.id}`, text: n.label ?? '', x: sx - cr.left + 8, y: sy - cr.top - 14 })
  }
  for (const m of structure.members) {
    const n1 = structure.nodeById(m.startNodeId)
    const n2 = structure.nodeById(m.endNodeId)
    if (!n1 || !n2) continue
    const mx = (n1.x + n2.x) / 2, my = (n1.y + n2.y) / 2, mz = ((n1.z ?? 0) + (n2.z ?? 0)) / 2
    const { sx, sy } = projectToScreen(mx, my, mz, sceneMan.camera, cr)
    items.push({ key: `m-${m.id}`, text: m.label ?? '', x: sx - cr.left + 6, y: sy - cr.top - 10 })
  }
  labels.value = items
}

function toggleCameraMode() {
  const next = cameraMode.value === '2d' ? '3d' : '2d'
  setCameraMode(next)
  sceneMan?.setMode(next)
  suppRend?.update(structure.nodes, next)
}

function handlePresetView(view: 'top' | 'front' | 'side' | 'iso') {
  sceneMan?.setPresetView(view)
}

onMounted(() => {
  sceneMan = new SceneManager(containerRef.value!)
  structRend = new StructureRenderer(sceneMan.scene)
  gridRend = new GridRenderer(sceneMan.scene)
  loadsRend = new LoadsRenderer(sceneMan.scene)
  suppRend = new SupportRenderer(sceneMan.scene)
  sceneMan.addFrameCallback(() => {
    if (sceneMan && gridRend) gridRend.update(sceneMan, workplaneZ.value)
    if (sceneMan) {
      const newK = sceneMan.orthoZoom * 80
      if (Math.abs(viewport.value.k - newK) > 0.5) setViewport({ ...viewport.value, k: newK })
    }
    updateLabels()
  })
  attach(sceneMan, structRend, sceneMan.renderer.domElement)
  updateScene()
})

onUnmounted(() => {
  if (sceneMan) detach(sceneMan.renderer.domElement)
  structRend?.dispose()
  gridRend?.dispose()
  loadsRend?.dispose()
  suppRend?.dispose()
  sceneMan?.dispose()
})

watch(
  [
    () => structure.nodes, () => structure.members,
    () => structure.selectedNodeIds, () => structure.selectedMemberIds,
    () => solver.result, () => solver.showDeformed, () => solver.deformedScale,
    () => loads.loads,
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
  <div id="structure-canvas" ref="containerRef" class="w-full h-full relative" :style="{ cursor: canvasCursor }">
    <div v-if="selectionRect" :style="selectionOverlayStyle" />
    <span
      v-for="lbl in labels" :key="lbl.key"
      class="absolute pointer-events-none select-none font-mono text-[10px] leading-none"
      :class="lbl.key.startsWith('n-') ? 'text-slate-500' : 'text-slate-400'"
      :style="{ left: `${lbl.x}px`, top: `${lbl.y}px` }"
    >{{ lbl.text }}</span>
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
    <WorkplaneControls
      v-if="cameraMode === '3d'"
      :on-preset-view="handlePresetView"
      class="absolute top-12 right-2 z-10"
    />
  </div>
</template>
