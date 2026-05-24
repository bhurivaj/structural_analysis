import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { useUndoRedo } from '@/composables/useUndoRedo'
import { useStructureStore } from '@/stores/structureStore'

// useUndoRedo uses module-level refs (past, future) that persist within the
// test file. We set up ONE Pinia instance for all tests so the watch stays
// wired to the same store instances throughout.
describe('useUndoRedo', () => {
  let structure: ReturnType<typeof useStructureStore>
  let undoRedo: ReturnType<typeof useUndoRedo>

  beforeAll(() => {
    setActivePinia(createPinia())
    structure = useStructureStore()
    undoRedo = useUndoRedo()
  })

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── initial state ─────────────────────────────────────────────────────────────
  it('starts with empty undo and redo stacks', () => {
    expect(undoRedo.canUndo.value).toBe(false)
    expect(undoRedo.canRedo.value).toBe(false)
  })

  // ── snapshot on change ────────────────────────────────────────────────────────
  it('canUndo becomes true after a store change and the 300ms debounce elapses', async () => {
    structure.addNode({ x: 0, y: 0, support: 'free' })
    await nextTick()             // watch fires → setTimeout(300) scheduled
    vi.advanceTimersByTime(300)  // setTimeout fires → past.push(_prev)
    await nextTick()             // canUndo computed updates
    expect(undoRedo.canUndo.value).toBe(true)
    expect(undoRedo.canRedo.value).toBe(false)
  })

  // ── undo ──────────────────────────────────────────────────────────────────────
  it('undo restores the previous state and enables redo', async () => {
    const countBefore = structure.nodes.length
    structure.addNode({ x: 5, y: 0, support: 'free' })
    await nextTick()
    vi.advanceTimersByTime(300)
    await nextTick()

    expect(structure.nodes.length).toBe(countBefore + 1)
    undoRedo.undo()
    await nextTick()

    expect(structure.nodes.length).toBe(countBefore)
    expect(undoRedo.canRedo.value).toBe(true)
  })

  // ── redo ──────────────────────────────────────────────────────────────────────
  it('redo re-applies the undone change', async () => {
    const countBefore = structure.nodes.length
    undoRedo.redo()
    await nextTick()

    expect(structure.nodes.length).toBe(countBefore + 1)
    expect(undoRedo.canRedo.value).toBe(false)
  })

  // ── no-op guards ─────────────────────────────────────────────────────────────
  it('undo on an empty past stack is a no-op', () => {
    while (undoRedo.canUndo.value) undoRedo.undo()
    const nodeCount = structure.nodes.length
    undoRedo.undo()
    expect(structure.nodes.length).toBe(nodeCount)
  })

  it('redo on an empty future stack is a no-op', () => {
    while (undoRedo.canRedo.value) undoRedo.redo()
    const nodeCount = structure.nodes.length
    undoRedo.redo()
    expect(structure.nodes.length).toBe(nodeCount)
  })

  // ── redo stack cleared on new change ─────────────────────────────────────────
  it('making a new change clears the redo stack', async () => {
    // Ensure we have something to undo/redo
    structure.addNode({ x: 1, y: 0, support: 'free' })
    await nextTick()
    vi.advanceTimersByTime(300)
    await nextTick()

    undoRedo.undo()
    await nextTick()
    expect(undoRedo.canRedo.value).toBe(true)

    // New change should wipe future
    structure.addNode({ x: 2, y: 0, support: 'free' })
    await nextTick()
    vi.advanceTimersByTime(300)
    await nextTick()

    expect(undoRedo.canRedo.value).toBe(false)
  })
})
