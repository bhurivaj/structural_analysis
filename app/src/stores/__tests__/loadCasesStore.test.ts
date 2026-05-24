import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLoadCasesStore } from '../loadCasesStore'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('loadCasesStore', () => {
  it('seeds with 5 AISC built-in combinations on init', () => {
    const store = useLoadCasesStore()
    expect(store.combinations).toHaveLength(5)
    expect(store.combinations.map(c => c.id)).toContain('lc2')
    expect(store.combinations.map(c => c.id)).toContain('lc_service')
  })

  it('default active combination is lc_service', () => {
    const store = useLoadCasesStore()
    expect(store.activeCombinationId).toBe('lc_service')
    expect(store.activeCombination.id).toBe('lc_service')
  })

  it('setActive changes the active combination', () => {
    const store = useLoadCasesStore()
    store.setActive('lc2')
    expect(store.activeCombinationId).toBe('lc2')
    expect(store.activeCombination.name).toBe('1.2D + 1.6L')
  })

  it('setActive ignores unknown id', () => {
    const store = useLoadCasesStore()
    store.setActive('nonexistent')
    expect(store.activeCombinationId).toBe('lc_service')
  })

  it('addCombination creates a custom combination', () => {
    const store = useLoadCasesStore()
    const added = store.addCombination({ name: 'My Combo', factors: [{ case: 'D', factor: 1.0 }] })
    expect(added.isCustom).toBe(true)
    expect(store.combinations).toHaveLength(6)
    expect(store.combinations.find(c => c.id === added.id)?.name).toBe('My Combo')
  })

  it('updateCombination changes name and factors', () => {
    const store = useLoadCasesStore()
    const added = store.addCombination({ name: 'Old Name', factors: [] })
    store.updateCombination(added.id, { name: 'New Name', factors: [{ case: 'L', factor: 2.0 }] })
    const found = store.combinations.find(c => c.id === added.id)!
    expect(found.name).toBe('New Name')
    expect(found.factors[0].factor).toBe(2.0)
  })

  it('deleteCombination removes custom combo', () => {
    const store = useLoadCasesStore()
    const added = store.addCombination({ name: 'Temp', factors: [] })
    store.deleteCombination(added.id)
    expect(store.combinations.find(c => c.id === added.id)).toBeUndefined()
    expect(store.combinations).toHaveLength(5)
  })

  it('deleteCombination cannot delete built-in combos', () => {
    const store = useLoadCasesStore()
    store.deleteCombination('lc2')
    expect(store.combinations.find(c => c.id === 'lc2')).toBeDefined()
    expect(store.combinations).toHaveLength(5)
  })

  it('deleting active custom combo falls back to first combo', () => {
    const store = useLoadCasesStore()
    const added = store.addCombination({ name: 'Temp', factors: [] })
    store.setActive(added.id)
    store.deleteCombination(added.id)
    expect(store.activeCombinationId).not.toBe(added.id)
    expect(store.combinations.some(c => c.id === store.activeCombinationId)).toBe(true)
  })

  it('save and load round-trips custom combos and active id', () => {
    const store = useLoadCasesStore()
    const added = store.addCombination({ name: 'Custom1', factors: [{ case: 'W', factor: 1.5 }] })
    store.setActive(added.id)
    store.save()

    setActivePinia(createPinia())
    const store2 = useLoadCasesStore()
    store2.load()

    expect(store2.combinations.find(c => c.name === 'Custom1')).toBeDefined()
    expect(store2.activeCombinationId).toBe(added.id)
  })

  it('load with no stored data keeps AISC defaults', () => {
    const store = useLoadCasesStore()
    store.load()
    expect(store.combinations).toHaveLength(5)
    expect(store.activeCombinationId).toBe('lc_service')
  })

  it('load with malformed data does not crash', () => {
    localStorage.setItem('structcalc_load_cases', 'not-json')
    const store = useLoadCasesStore()
    expect(() => store.load()).not.toThrow()
  })
})
