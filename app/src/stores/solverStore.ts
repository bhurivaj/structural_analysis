import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SolverResult } from '@/types/solver'
import { useStructureStore } from './structureStore'
import { useLoadsStore } from './loadsStore'
import { runFemAnalysis } from '@/solver'

export const useSolverStore = defineStore('solver', () => {
  const result = ref<SolverResult | null>(null)
  const isRunning = ref(false)
  const diagramMode = ref<'N' | 'V' | 'M' | null>(null)
  const deformedScale = ref(100)
  const showDeformed = ref(false)
  const snapshotDataUrl = ref('')

  async function runAnalysis() {
    const structureStore = useStructureStore()
    const loadsStore = useLoadsStore()
    isRunning.value = true
    result.value = null
    try {
      const res = runFemAnalysis(
        structureStore.nodes,
        structureStore.members,
        loadsStore.loads,
        structureStore.structureType,
      )
      result.value = res
    } finally {
      isRunning.value = false
    }
  }

  function clearResult() {
    result.value = null
    showDeformed.value = false
  }

  function toggleDeformed() {
    showDeformed.value = !showDeformed.value
  }

  function setDiagramMode(mode: 'N' | 'V' | 'M' | null) {
    diagramMode.value = mode
  }

  function setDeformedScale(scale: number) {
    deformedScale.value = scale
  }

  return {
    result,
    isRunning,
    diagramMode,
    deformedScale,
    showDeformed,
    snapshotDataUrl,
    runAnalysis,
    clearResult,
    setDiagramMode,
    setDeformedScale,
    toggleDeformed,
  }
})
