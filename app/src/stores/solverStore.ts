import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SolverResult, EnvelopeResult } from '@/types/solver'
import { useStructureStore } from './structureStore'
import { useLoadsStore } from './loadsStore'
import { useLoadCasesStore } from './loadCasesStore'
import { runFemAnalysis } from '@/solver'
import { buildFactoredLoads } from '@/solver/buildFactoredLoads'
import { computeEnvelope, computeEnvelopeDiagrams } from '@/solver/envelopeAnalysis'

export const useSolverStore = defineStore('solver', () => {
  const result = ref<SolverResult | null>(null)
  const envelopeResult = ref<EnvelopeResult | null>(null)
  const isRunning = ref(false)
  const isRunningEnvelope = ref(false)
  const diagramMode = ref<'N' | 'V' | 'M' | null>(null)
  const deformedScale = ref(100)
  const showDeformed = ref(false)
  const snapshotDataUrl = ref('')
  const lastCombinationName = ref<string>('')

  async function runAnalysis() {
    const structureStore = useStructureStore()
    const loadsStore = useLoadsStore()
    const loadCasesStore = useLoadCasesStore()
    isRunning.value = true
    result.value = null
    try {
      const combo = loadCasesStore.activeCombination
      const factoredLoads = buildFactoredLoads(loadsStore.loads, combo)
      lastCombinationName.value = combo.name
      const res = runFemAnalysis(
        structureStore.nodes,
        structureStore.members,
        factoredLoads,
        structureStore.structureType,
      )
      result.value = res
    } finally {
      isRunning.value = false
    }
  }

  async function runEnvelopeAnalysis() {
    const structureStore = useStructureStore()
    const loadsStore = useLoadsStore()
    const loadCasesStore = useLoadCasesStore()
    isRunningEnvelope.value = true
    envelopeResult.value = null
    try {
      const perComboResults: EnvelopeResult['perComboResults'] = []
      const combinationNames: Record<string, string> = {}

      for (const combo of loadCasesStore.combinations) {
        const factoredLoads = buildFactoredLoads(loadsStore.loads, combo)
        const res = runFemAnalysis(
          structureStore.nodes,
          structureStore.members,
          factoredLoads,
          structureStore.structureType,
        )
        if (res.success) {
          perComboResults.push({ comboId: combo.id, comboName: combo.name, memberResults: res.memberResults })
          combinationNames[combo.id] = combo.name
        }
      }

      if (perComboResults.length === 0) {
        envelopeResult.value = {
          success: false,
          error: 'No combinations produced valid results.',
          envelopes: [],
          perComboResults: [],
          combinationNames: {},
          timestamp: Date.now(),
        }
        return
      }

      const envelopes = computeEnvelope(perComboResults)
      const diagramEnvelopes = computeEnvelopeDiagrams(perComboResults)
      envelopeResult.value = { success: true, envelopes, perComboResults, combinationNames, diagramEnvelopes, timestamp: Date.now() }
    } catch (e) {
      envelopeResult.value = {
        success: false,
        error: String(e),
        envelopes: [],
        perComboResults: [],
        combinationNames: {},
        timestamp: Date.now(),
      }
    } finally {
      isRunningEnvelope.value = false
    }
  }

  function clearResult() {
    result.value = null
    envelopeResult.value = null
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
    envelopeResult,
    isRunning,
    isRunningEnvelope,
    diagramMode,
    deformedScale,
    showDeformed,
    snapshotDataUrl,
    lastCombinationName,
    runAnalysis,
    runEnvelopeAnalysis,
    clearResult,
    setDiagramMode,
    setDeformedScale,
    toggleDeformed,
  }
})
