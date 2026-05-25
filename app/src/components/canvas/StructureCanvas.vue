<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { SceneManager } from './three/SceneManager'
import { StructureRenderer } from './three/StructureRenderer'
import { useStructureStore } from '@/stores/structureStore'
import { useSolverStore } from '@/stores/solverStore'

const containerRef = ref<HTMLDivElement | null>(null)
let sceneMan: SceneManager | null = null
let structRend: StructureRenderer | null = null

const structure = useStructureStore()
const solver = useSolverStore()

function buildDeformedMap() {
  if (!solver.result?.success || !solver.showDeformed) return undefined
  const m = new Map<string, { ux: number; uy: number }>()
  for (const r of solver.result.nodeResults) {
    m.set(r.nodeId, { ux: r.ux, uy: r.uy })
  }
  return m
}

function updateScene() {
  structRend?.update(
    structure.nodes,
    structure.members,
    structure.selectedNodeIds,
    structure.selectedMemberIds,
    buildDeformedMap(),
    solver.deformedScale
  )
}

onMounted(() => {
  sceneMan = new SceneManager(containerRef.value!)
  structRend = new StructureRenderer(sceneMan.scene)
  updateScene()
})

onUnmounted(() => {
  structRend?.dispose()
  sceneMan?.dispose()
})

watch(
  [
    () => structure.nodes,
    () => structure.members,
    () => structure.selectedNodeIds,
    () => structure.selectedMemberIds,
    () => solver.result,
    () => solver.showDeformed,
    () => solver.deformedScale,
  ],
  updateScene,
  { deep: true }
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
  <div ref="containerRef" class="w-full h-full" />
</template>
