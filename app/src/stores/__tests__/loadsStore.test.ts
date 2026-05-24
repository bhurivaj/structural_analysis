import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLoadsStore } from '@/stores/loadsStore'
import { useStructureStore } from '@/stores/structureStore'

describe('loadsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ── initial state ────────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('starts with no loads', () => {
      const store = useLoadsStore()
      expect(store.loads).toEqual([])
    })
  })

  // ── addPointLoad ─────────────────────────────────────────────────────────────
  describe('addPointLoad', () => {
    it('adds a point load to the store', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N1', fx: 10, fy: -20 })
      expect(store.loads.length).toBe(1)
      expect(store.loads[0].type).toBe('point_load')
    })

    it('returns the created load with type and id', () => {
      const store = useLoadsStore()
      const load = store.addPointLoad({ nodeId: 'N1', fx: 5, fy: 0 })
      expect(load.type).toBe('point_load')
      expect(load.id).toBeTruthy()
      expect(load.fx).toBe(5)
    })

    it('generates unique ids', () => {
      const store = useLoadsStore()
      const l1 = store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      const l2 = store.addPointLoad({ nodeId: 'N1', fx: 2, fy: 0 })
      expect(l1.id).not.toBe(l2.id)
    })
  })

  // ── addDistributedLoad ──────────────────────────────────────────────────────
  describe('addDistributedLoad', () => {
    it('adds a distributed load with correct type', () => {
      const store = useLoadsStore()
      store.addDistributedLoad({ memberId: 'M1', w1: 10, w2: 10, direction: 'local_y' })
      expect(store.loads[0].type).toBe('distributed_load')
    })

    it('returns the created load with id', () => {
      const store = useLoadsStore()
      const dl = store.addDistributedLoad({ memberId: 'M1', w1: 5, w2: 15, direction: 'global_y' })
      expect(dl.id).toBeTruthy()
      expect(dl.w1).toBe(5)
      expect(dl.w2).toBe(15)
    })
  })

  // ── addMomentLoad ───────────────────────────────────────────────────────────
  describe('addMomentLoad', () => {
    it('adds a moment load with correct type', () => {
      const store = useLoadsStore()
      store.addMomentLoad({ nodeId: 'N2', mz: 50 })
      expect(store.loads[0].type).toBe('moment')
    })

    it('returns moment load with mz value', () => {
      const store = useLoadsStore()
      const ml = store.addMomentLoad({ nodeId: 'N2', mz: 100 })
      expect(ml).not.toBeNull()
      expect(ml!.mz).toBe(100)
    })
  })

  // ── computed filters ─────────────────────────────────────────────────────────
  describe('pointLoads computed', () => {
    it('returns only point loads', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      store.addDistributedLoad({ memberId: 'M1', w1: 5, w2: 5, direction: 'local_y' })
      store.addMomentLoad({ nodeId: 'N1', mz: 10 })
      expect(store.pointLoads.length).toBe(1)
      expect(store.pointLoads[0].type).toBe('point_load')
    })
  })

  describe('distributedLoads computed', () => {
    it('returns only distributed loads', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      store.addDistributedLoad({ memberId: 'M1', w1: 5, w2: 5, direction: 'local_y' })
      expect(store.distributedLoads.length).toBe(1)
    })
  })

  describe('momentLoads computed', () => {
    it('returns only moment loads', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      store.addMomentLoad({ nodeId: 'N1', mz: 10 })
      expect(store.momentLoads.length).toBe(1)
      expect(store.momentLoads[0].type).toBe('moment')
    })
  })

  describe('loadsByNode computed', () => {
    it('returns all point and moment loads for a given node', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N1', fx: 5, fy: 0 })
      store.addMomentLoad({ nodeId: 'N1', mz: 10 })
      store.addPointLoad({ nodeId: 'N2', fx: 1, fy: 0 })
      expect(store.loadsByNode('N1').length).toBe(2)
    })

    it('does not include distributed loads in loadsByNode', () => {
      const store = useLoadsStore()
      store.addDistributedLoad({ memberId: 'M1', w1: 5, w2: 5, direction: 'local_y' })
      expect(store.loadsByNode('M1').length).toBe(0)
    })

    it('returns empty for node with no loads', () => {
      const store = useLoadsStore()
      expect(store.loadsByNode('X99')).toEqual([])
    })
  })

  describe('loadsByMember computed', () => {
    it('returns distributed loads for a given member', () => {
      const store = useLoadsStore()
      store.addDistributedLoad({ memberId: 'M1', w1: 10, w2: 10, direction: 'local_y' })
      store.addDistributedLoad({ memberId: 'M2', w1: 5, w2: 5, direction: 'global_y' })
      expect(store.loadsByMember('M1').length).toBe(1)
    })

    it('returns empty for member with no distributed load', () => {
      const store = useLoadsStore()
      expect(store.loadsByMember('M99')).toEqual([])
    })
  })

  // ── updateLoad ───────────────────────────────────────────────────────────────
  describe('updateLoad', () => {
    it('updates fx on a point load', () => {
      const store = useLoadsStore()
      const load = store.addPointLoad({ nodeId: 'N1', fx: 10, fy: 0 })
      store.updateLoad(load.id, { fx: 50 } as Parameters<typeof store.updateLoad>[1])
      expect(store.loads[0]).toMatchObject({ fx: 50 })
    })

    it('silently ignores unknown load id', () => {
      const store = useLoadsStore()
      expect(() => store.updateLoad('ghost', { fx: 99 } as Parameters<typeof store.updateLoad>[1])).not.toThrow()
    })
  })

  // ── deleteLoad ───────────────────────────────────────────────────────────────
  describe('deleteLoad', () => {
    it('removes the load from the array', () => {
      const store = useLoadsStore()
      const load = store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      store.deleteLoad(load.id)
      expect(store.loads).toEqual([])
    })

    it('only removes the targeted load', () => {
      const store = useLoadsStore()
      const l1 = store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      store.addPointLoad({ nodeId: 'N1', fx: 2, fy: 0 })
      store.deleteLoad(l1.id)
      expect(store.loads.length).toBe(1)
    })
  })

  // ── clearLoads ───────────────────────────────────────────────────────────────
  describe('clearLoads', () => {
    it('removes all loads', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      store.addMomentLoad({ nodeId: 'N1', mz: 5 })
      store.clearLoads()
      expect(store.loads).toEqual([])
    })
  })

  // ── loadSnapshot ─────────────────────────────────────────────────────────────
  describe('loadSnapshot', () => {
    it('replaces the loads array with snapshot data', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N1', fx: 10, fy: 0 })
      const snapLoads = [
        { id: 'snap-1', type: 'moment' as const, nodeId: 'X', mz: 99 },
      ]
      store.loadSnapshot(snapLoads)
      expect(store.loads.length).toBe(1)
      expect(store.loads[0].id).toBe('snap-1')
    })

    it('loading an empty array clears loads', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      store.loadSnapshot([])
      expect(store.loads).toEqual([])
    })
  })

  // ── removeLoadsForNode ────────────────────────────────────────────────────────
  describe('removeLoadsForNode', () => {
    it('removes point and moment loads for the given node', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      store.addMomentLoad({ nodeId: 'N1', mz: 5 })
      store.removeLoadsForNode('N1')
      expect(store.loads).toEqual([])
    })

    it('keeps loads that belong to other nodes', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      store.addPointLoad({ nodeId: 'N2', fx: 2, fy: 0 })
      store.removeLoadsForNode('N1')
      expect(store.loads.length).toBe(1)
      expect((store.loads[0] as import('@/types/loads').PointLoad).nodeId).toBe('N2')
    })

    it('keeps distributed loads (they belong to members, not nodes)', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      store.addDistributedLoad({ memberId: 'M1', w1: 5, w2: 5, direction: 'local_y' })
      store.removeLoadsForNode('N1')
      expect(store.loads.length).toBe(1)
      expect(store.loads[0].type).toBe('distributed_load')
    })

    it('is a no-op when node has no loads', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N2', fx: 3, fy: 0 })
      store.removeLoadsForNode('N99')
      expect(store.loads.length).toBe(1)
    })
  })

  // ── removeLoadsForMember ──────────────────────────────────────────────────────
  describe('removeLoadsForMember', () => {
    it('removes distributed loads for the given member', () => {
      const store = useLoadsStore()
      store.addDistributedLoad({ memberId: 'M1', w1: 10, w2: 10, direction: 'local_y' })
      store.removeLoadsForMember('M1')
      expect(store.loads).toEqual([])
    })

    it('keeps distributed loads for other members', () => {
      const store = useLoadsStore()
      store.addDistributedLoad({ memberId: 'M1', w1: 10, w2: 10, direction: 'local_y' })
      store.addDistributedLoad({ memberId: 'M2', w1: 5, w2: 5, direction: 'global_y' })
      store.removeLoadsForMember('M1')
      expect(store.loads.length).toBe(1)
      expect((store.loads[0] as import('@/types/loads').DistributedLoad).memberId).toBe('M2')
    })

    it('keeps point and moment loads (they are node-based, not member-based)', () => {
      const store = useLoadsStore()
      store.addDistributedLoad({ memberId: 'M1', w1: 5, w2: 5, direction: 'local_y' })
      store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      store.removeLoadsForMember('M1')
      expect(store.loads.length).toBe(1)
      expect(store.loads[0].type).toBe('point_load')
    })

    it('is a no-op when member has no distributed loads', () => {
      const store = useLoadsStore()
      store.addDistributedLoad({ memberId: 'M2', w1: 3, w2: 3, direction: 'local_y' })
      store.removeLoadsForMember('M99')
      expect(store.loads.length).toBe(1)
    })
  })

  // ── removeMomentLoads ─────────────────────────────────────────────────────────
  describe('removeMomentLoads', () => {
    it('removes all moment loads and returns the count removed', () => {
      const store = useLoadsStore()
      store.addMomentLoad({ nodeId: 'N1', mz: 10 })
      store.addMomentLoad({ nodeId: 'N2', mz: 20 })
      store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      const removed = store.removeMomentLoads()
      expect(removed).toBe(2)
      expect(store.momentLoads.length).toBe(0)
      expect(store.pointLoads.length).toBe(1)
    })

    it('returns 0 when there are no moment loads', () => {
      const store = useLoadsStore()
      store.addPointLoad({ nodeId: 'N1', fx: 1, fy: 0 })
      const removed = store.removeMomentLoads()
      expect(removed).toBe(0)
    })
  })

  // ── addMomentLoad on truss ────────────────────────────────────────────────────
  describe('addMomentLoad — truss guard', () => {
    it('returns null and does not add load when structure is a truss', () => {
      const structure = useStructureStore()
      structure.setStructureType('truss')

      const store = useLoadsStore()
      const result = store.addMomentLoad({ nodeId: 'N1', mz: 50 })
      expect(result).toBeNull()
      expect(store.momentLoads.length).toBe(0)
    })
  })
})
