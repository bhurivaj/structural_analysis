import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LoadCombination } from '@/types/loadCases'

const AISC_COMBINATIONS: LoadCombination[] = [
  { id: 'lc_service', name: 'Service (1.0D + 1.0L)', factors: [{ case: 'D', factor: 1.0 }, { case: 'L', factor: 1.0 }] },
  { id: 'lc1', name: '1.4D', factors: [{ case: 'D', factor: 1.4 }] },
  { id: 'lc2', name: '1.2D + 1.6L', factors: [{ case: 'D', factor: 1.2 }, { case: 'L', factor: 1.6 }] },
  { id: 'lc3', name: '1.2D + 1.0W + 1.0L', factors: [{ case: 'D', factor: 1.2 }, { case: 'W', factor: 1.0 }, { case: 'L', factor: 1.0 }] },
  { id: 'lc4', name: '0.9D + 1.0W', factors: [{ case: 'D', factor: 0.9 }, { case: 'W', factor: 1.0 }] },
]

const STORAGE_KEY = 'structcalc_load_cases'

export const useLoadCasesStore = defineStore('loadCases', () => {
  const combinations = ref<LoadCombination[]>(AISC_COMBINATIONS.map(c => ({ ...c, factors: [...c.factors] })))
  const activeCombinationId = ref<string>('lc_service')

  const activeCombination = computed(() =>
    combinations.value.find(c => c.id === activeCombinationId.value) ?? combinations.value[0],
  )

  function setActive(id: string) {
    if (combinations.value.some(c => c.id === id)) {
      activeCombinationId.value = id
    }
  }

  function addCombination(data: Omit<LoadCombination, 'id'>): LoadCombination {
    const id = `lc_custom_${Date.now()}`
    const combo: LoadCombination = { id, isCustom: true, ...data }
    combinations.value.push(combo)
    return combo
  }

  function updateCombination(id: string, data: Partial<Omit<LoadCombination, 'id'>>) {
    const idx = combinations.value.findIndex(c => c.id === id)
    if (idx >= 0) Object.assign(combinations.value[idx], data)
  }

  function deleteCombination(id: string) {
    const combo = combinations.value.find(c => c.id === id)
    if (!combo || !combo.isCustom) return
    combinations.value = combinations.value.filter(c => c.id !== id)
    if (activeCombinationId.value === id) {
      activeCombinationId.value = combinations.value[0]?.id ?? 'lc_service'
    }
  }

  function save() {
    const custom = combinations.value.filter(c => c.isCustom)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ custom, activeId: activeCombinationId.value }))
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const { custom, activeId } = JSON.parse(raw) as { custom: LoadCombination[]; activeId: string }
      combinations.value = [
        ...AISC_COMBINATIONS.map(c => ({ ...c, factors: [...c.factors] })),
        ...custom.map((c: LoadCombination) => ({ ...c, isCustom: true })),
      ]
      if (combinations.value.some(c => c.id === activeId)) {
        activeCombinationId.value = activeId
      }
    } catch {
      // ignore malformed data
    }
  }

  return {
    combinations,
    activeCombinationId,
    activeCombination,
    setActive,
    addCombination,
    updateCombination,
    deleteCombination,
    save,
    load,
  }
})
