import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionCache } from '@/composables/useSessionCache'
import { useStructureStore } from '@/stores/structureStore'
import { useLoadsStore } from '@/stores/loadsStore'

const STORAGE_KEY = 'structcalc_session'

// localStorage mock — compatible with all jsdom environments
function mockLocalStorage() {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    _reset: () => { store = {}; },
  }
}

describe('useSessionCache', () => {
  let lsMock: ReturnType<typeof mockLocalStorage>

  beforeEach(() => {
    setActivePinia(createPinia())
    lsMock = mockLocalStorage()
    Object.defineProperty(globalThis, 'localStorage', { value: lsMock, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getSavedSession', () => {
    it('returns null when localStorage is empty', () => {
      const { getSavedSession } = useSessionCache()
      expect(getSavedSession()).toBeNull()
    })

    it('returns null when stored data is empty (no nodes and no members)', () => {
      const { getSavedSession } = useSessionCache()
      lsMock.getItem.mockReturnValueOnce(JSON.stringify({
        nodes: [], members: [], structureType: 'frame', loads: [], savedAt: '',
      }))
      expect(getSavedSession()).toBeNull()
    })

    it('returns session when there are nodes saved', () => {
      const { getSavedSession } = useSessionCache()
      const snapshot = {
        nodes: [{ id: 'N1', x: 0, y: 0, support: 'pinned' }],
        members: [],
        structureType: 'frame',
        loads: [],
        savedAt: new Date().toISOString(),
      }
      lsMock.getItem.mockReturnValueOnce(JSON.stringify(snapshot))
      const result = getSavedSession()
      expect(result).not.toBeNull()
      expect(result!.nodes.length).toBe(1)
    })

    it('returns null when JSON is malformed', () => {
      const { getSavedSession } = useSessionCache()
      lsMock.getItem.mockReturnValueOnce('NOT VALID JSON {{{')
      expect(getSavedSession()).toBeNull()
    })

    it('includes savedAt in the returned snapshot', () => {
      const { getSavedSession } = useSessionCache()
      const savedAt = new Date().toISOString()
      lsMock.getItem.mockReturnValueOnce(JSON.stringify({
        nodes: [{ id: 'N1', x: 0, y: 0, support: 'free' }],
        members: [],
        structureType: 'frame',
        loads: [],
        savedAt,
      }))
      expect(getSavedSession()!.savedAt).toBe(savedAt)
    })
  })

  describe('saveSession', () => {
    it('writes session to localStorage via setItem', () => {
      const structure = useStructureStore()
      const { saveSession } = useSessionCache()
      structure.addNode({ x: 1, y: 2, support: 'fixed' })
      saveSession()
      expect(lsMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String))
    })

    it('saved data contains current nodes', () => {
      const structure = useStructureStore()
      const { saveSession } = useSessionCache()
      structure.addNode({ x: 5, y: 10, support: 'pinned' })
      saveSession()
      const raw = lsMock.setItem.mock.calls[0][1]
      const parsed = JSON.parse(raw)
      expect(parsed.nodes.length).toBe(1)
      expect(parsed.nodes[0].x).toBe(5)
    })

    it('saved data contains current loads', () => {
      const structure = useStructureStore()
      const loads = useLoadsStore()
      const { saveSession } = useSessionCache()
      structure.addNode({ x: 0, y: 0, support: 'free' })
      loads.addPointLoad({ nodeId: 'N1', fx: 10, fy: -20 })
      saveSession()
      const raw = lsMock.setItem.mock.calls[0][1]
      const parsed = JSON.parse(raw)
      expect(parsed.loads.length).toBe(1)
    })

    it('saved session contains current structureType', () => {
      const structure = useStructureStore()
      const { saveSession } = useSessionCache()
      structure.addNode({ x: 0, y: 0, support: 'free' })
      structure.setStructureType('truss')
      saveSession()
      const raw = lsMock.setItem.mock.calls[0][1]
      const parsed = JSON.parse(raw)
      expect(parsed.structureType).toBe('truss')
    })

    it('does not throw when setItem throws (e.g. quota exceeded)', () => {
      const structure = useStructureStore()
      const { saveSession } = useSessionCache()
      structure.addNode({ x: 0, y: 0, support: 'free' })
      lsMock.setItem.mockImplementationOnce(() => { throw new Error('QuotaExceededError') })
      expect(() => saveSession()).not.toThrow()
    })

    it('saved session contains a savedAt timestamp string', () => {
      const structure = useStructureStore()
      const { saveSession } = useSessionCache()
      structure.addNode({ x: 0, y: 0, support: 'free' })
      saveSession()
      const raw = lsMock.setItem.mock.calls[0][1]
      const parsed = JSON.parse(raw)
      expect(typeof parsed.savedAt).toBe('string')
      expect(parsed.savedAt).not.toBe('')
    })
  })

  describe('restoreSession', () => {
    it('does nothing when no session is saved', () => {
      const structure = useStructureStore()
      const { restoreSession } = useSessionCache()
      restoreSession()
      expect(structure.nodes).toEqual([])
    })

    it('restores nodes from saved session', () => {
      const structure = useStructureStore()
      const { restoreSession } = useSessionCache()
      const snapshot = {
        nodes: [{ id: 'snap-N1', x: 3, y: 7, support: 'roller', rollerAxis: 'y' }],
        members: [],
        structureType: 'frame',
        loads: [],
        savedAt: new Date().toISOString(),
      }
      lsMock.getItem.mockReturnValue(JSON.stringify(snapshot))
      restoreSession()
      expect(structure.nodes.length).toBe(1)
      expect(structure.nodes[0].x).toBe(3)
    })

    it('restores loads from saved session', () => {
      const loads = useLoadsStore()
      const structure = useStructureStore()
      const { restoreSession } = useSessionCache()
      const snapshot = {
        nodes: [{ id: 'N1', x: 0, y: 0, support: 'free' }],
        members: [],
        structureType: 'frame',
        loads: [{ id: 'snap-L1', type: 'moment', nodeId: 'N1', mz: 75 }],
        savedAt: new Date().toISOString(),
      }
      lsMock.getItem.mockReturnValue(JSON.stringify(snapshot))
      restoreSession()
      expect(loads.loads.length).toBe(1)
    })

    it('restores structureType from saved session', () => {
      const structure = useStructureStore()
      const { restoreSession } = useSessionCache()
      const snapshot = {
        nodes: [{ id: 'N1', x: 0, y: 0, support: 'free' }],
        members: [],
        structureType: 'truss',
        loads: [],
        savedAt: new Date().toISOString(),
      }
      lsMock.getItem.mockReturnValue(JSON.stringify(snapshot))
      restoreSession()
      expect(structure.structureType).toBe('truss')
    })
  })

  describe('clearSavedSession', () => {
    it('calls removeItem on localStorage', () => {
      const { clearSavedSession } = useSessionCache()
      clearSavedSession()
      expect(lsMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY)
    })

    it('after clear, getSavedSession returns null', () => {
      const { getSavedSession, clearSavedSession } = useSessionCache()
      // After removeItem, getItem returns null
      lsMock.removeItem.mockImplementationOnce(() => {
        lsMock.getItem.mockReturnValue(null as any)
      })
      clearSavedSession()
      expect(getSavedSession()).toBeNull()
    })
  })
})
