import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useStructureStore } from '@/stores/structureStore'
import type { StructureNode, Member } from '@/types/structure'

function defaultMemberProps(): Omit<Member, 'id'> {
  return {
    startNodeId: '',
    endNodeId: '',
    steelProfileId: null,
    E: 200000,
    A: 6353,
    I: 4.72e7,
    isTruss: false,
  }
}

describe('structureStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // ── initial state ───────────────────────────────────────────────────────────
  describe('initial state', () => {
    it('starts with empty nodes', () => {
      const store = useStructureStore()
      expect(store.nodes).toEqual([])
    })

    it('starts with empty members', () => {
      const store = useStructureStore()
      expect(store.members).toEqual([])
    })

    it('defaults to frame structure type', () => {
      const store = useStructureStore()
      expect(store.structureType).toBe('frame')
    })

    it('starts with no selection', () => {
      const store = useStructureStore()
      expect(store.selectedNodeIds).toEqual([])
      expect(store.selectedMemberIds).toEqual([])
    })
  })

  // ── addNode ─────────────────────────────────────────────────────────────────
  describe('addNode', () => {
    it('adds a node to the nodes array', () => {
      const store = useStructureStore()
      store.addNode({ x: 0, y: 0, support: 'free' })
      expect(store.nodes.length).toBe(1)
    })

    it('returns the added node with an id', () => {
      const store = useStructureStore()
      const node = store.addNode({ x: 1, y: 2, support: 'pinned' })
      expect(node.id).toBeTruthy()
      expect(node.x).toBe(1)
      expect(node.y).toBe(2)
    })

    it('generates unique ids for each node', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 1, y: 1, support: 'free' })
      expect(n1.id).not.toBe(n2.id)
    })

    it('auto-labels nodes N1, N2, ...', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 1, y: 0, support: 'free' })
      expect(n1.label).toBe('N1')
      expect(n2.label).toBe('N2')
    })
  })

  // ── updateNode ──────────────────────────────────────────────────────────────
  describe('updateNode', () => {
    it('updates node coordinates', () => {
      const store = useStructureStore()
      const node = store.addNode({ x: 0, y: 0, support: 'free' })
      store.updateNode(node.id, { x: 5, y: 10 })
      expect(store.nodes[0].x).toBe(5)
      expect(store.nodes[0].y).toBe(10)
    })

    it('updates support type', () => {
      const store = useStructureStore()
      const node = store.addNode({ x: 0, y: 0, support: 'free' })
      store.updateNode(node.id, { support: 'fixed' })
      expect(store.nodes[0].support).toBe('fixed')
    })

    it('silently ignores unknown id', () => {
      const store = useStructureStore()
      store.addNode({ x: 0, y: 0, support: 'free' })
      expect(() => store.updateNode('no-such-id', { x: 99 })).not.toThrow()
      expect(store.nodes[0].x).toBe(0)
    })
  })

  // ── deleteNode ──────────────────────────────────────────────────────────────
  describe('deleteNode', () => {
    it('removes the node from the array', () => {
      const store = useStructureStore()
      const node = store.addNode({ x: 0, y: 0, support: 'free' })
      store.deleteNode(node.id)
      expect(store.nodes).toEqual([])
    })

    it('also removes connected members', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.deleteNode(n1.id)
      expect(store.members).toEqual([])
    })

    it('does not remove members unconnected to deleted node', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const n3 = store.addNode({ x: 10, y: 0, support: 'free' })
      store.addMember({ ...defaultMemberProps(), startNodeId: n2.id, endNodeId: n3.id })
      store.deleteNode(n1.id)
      expect(store.members.length).toBe(1)
    })

    it('removes deleted node from selection', () => {
      const store = useStructureStore()
      const node = store.addNode({ x: 0, y: 0, support: 'free' })
      store.selectNode(node.id)
      store.deleteNode(node.id)
      expect(store.selectedNodeIds).not.toContain(node.id)
    })
  })

  // ── addMember / updateMember / deleteMember ─────────────────────────────────
  describe('addMember', () => {
    it('adds a member to the members array', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      expect(store.members.length).toBe(1)
    })

    it('returns the member with a unique id', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const m = store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      expect(m.id).toBeTruthy()
    })
  })

  describe('updateMember', () => {
    it('updates member E value', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const m = store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.updateMember(m.id, { E: 210000 })
      expect(store.members[0].E).toBe(210000)
    })

    it('reconnects member start node to a different node', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const n3 = store.addNode({ x: 10, y: 0, support: 'free' })
      const m = store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.updateMember(m.id, { startNodeId: n3.id })
      expect(store.members[0].startNodeId).toBe(n3.id)
      expect(store.members[0].endNodeId).toBe(n2.id)
    })

    it('reconnects member end node to a different node', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const n3 = store.addNode({ x: 10, y: 0, support: 'free' })
      const m = store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.updateMember(m.id, { endNodeId: n3.id })
      expect(store.members[0].startNodeId).toBe(n1.id)
      expect(store.members[0].endNodeId).toBe(n3.id)
    })

    it('silently ignores unknown member id', () => {
      const store = useStructureStore()
      expect(() => store.updateMember('ghost', { E: 999 })).not.toThrow()
    })
  })

  describe('deleteMember', () => {
    it('removes the member from the array', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const m = store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.deleteMember(m.id)
      expect(store.members).toEqual([])
    })

    it('removes deleted member from selection', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const m = store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.selectMember(m.id)
      store.deleteMember(m.id)
      expect(store.selectedMemberIds).not.toContain(m.id)
    })
  })

  // ── selection ───────────────────────────────────────────────────────────────
  describe('selectNode', () => {
    it('selects a node exclusively by default', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      store.selectNode(n1.id)
      store.selectNode(n2.id)
      expect(store.selectedNodeIds).toEqual([n2.id])
    })

    it('clears member selection when selecting a node', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const m = store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.selectMember(m.id)
      store.selectNode(n1.id)
      expect(store.selectedMemberIds).toEqual([])
    })

    it('multi-select adds to selection when multi=true', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      store.selectNode(n1.id, true)
      store.selectNode(n2.id, true)
      expect(store.selectedNodeIds).toContain(n1.id)
      expect(store.selectedNodeIds).toContain(n2.id)
    })

    it('multi-select deselects an already selected node', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      store.selectNode(n1.id, true)
      store.selectNode(n1.id, true)
      expect(store.selectedNodeIds).not.toContain(n1.id)
    })
  })

  describe('selectMember', () => {
    it('selects a member exclusively', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const n3 = store.addNode({ x: 10, y: 0, support: 'free' })
      const m1 = store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      const m2 = store.addMember({ ...defaultMemberProps(), startNodeId: n2.id, endNodeId: n3.id })
      store.selectMember(m1.id)
      store.selectMember(m2.id)
      expect(store.selectedMemberIds).toEqual([m2.id])
    })

    it('clears node selection when selecting a member', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const m = store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.selectNode(n1.id)
      store.selectMember(m.id)
      expect(store.selectedNodeIds).toEqual([])
    })
  })

  describe('clearSelection', () => {
    it('clears all selections', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const m = store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.selectNode(n1.id)
      store.selectMember(m.id)
      store.clearSelection()
      expect(store.selectedNodeIds).toEqual([])
      expect(store.selectedMemberIds).toEqual([])
    })

    it('clears pendingMemberStartNodeId', () => {
      const store = useStructureStore()
      store.pendingMemberStartNodeId = 'some-id'
      store.clearSelection()
      expect(store.pendingMemberStartNodeId).toBeNull()
    })
  })

  // ── setStructureType ─────────────────────────────────────────────────────────
  describe('setStructureType', () => {
    it('switches structureType to truss', () => {
      const store = useStructureStore()
      store.setStructureType('truss')
      expect(store.structureType).toBe('truss')
    })

    it('sets isTruss=true on all members when switching to truss', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.setStructureType('truss')
      expect(store.members[0].isTruss).toBe(true)
    })

    it('sets I=0 on all members when switching to truss', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.setStructureType('truss')
      expect(store.members[0].I).toBe(0)
    })

    it('sets isTruss=false on all members when switching back to frame', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.setStructureType('truss')
      store.setStructureType('frame')
      expect(store.members[0].isTruss).toBe(false)
    })
  })

  // ── clearAll ─────────────────────────────────────────────────────────────────
  describe('clearAll', () => {
    it('removes all nodes and members', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      store.clearAll()
      expect(store.nodes).toEqual([])
      expect(store.members).toEqual([])
    })

    it('clears selections', () => {
      const store = useStructureStore()
      const n = store.addNode({ x: 0, y: 0, support: 'free' })
      store.selectNode(n.id)
      store.clearAll()
      expect(store.selectedNodeIds).toEqual([])
    })
  })

  // ── computed getters ─────────────────────────────────────────────────────────
  describe('computed getters', () => {
    it('nodeById returns the correct node', () => {
      const store = useStructureStore()
      const node = store.addNode({ x: 1, y: 2, support: 'free' })
      expect(store.nodeById(node.id)).toBe(store.nodes[0])
    })

    it('nodeById returns undefined for unknown id', () => {
      const store = useStructureStore()
      expect(store.nodeById('ghost')).toBeUndefined()
    })

    it('memberById returns the correct member', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const m = store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      expect(store.memberById(m.id)).toBe(store.members[0])
    })

    it('connectedMembers returns all members touching a node', () => {
      const store = useStructureStore()
      const n1 = store.addNode({ x: 0, y: 0, support: 'free' })
      const n2 = store.addNode({ x: 5, y: 0, support: 'free' })
      const n3 = store.addNode({ x: 10, y: 0, support: 'free' })
      const m1 = store.addMember({ ...defaultMemberProps(), startNodeId: n1.id, endNodeId: n2.id })
      const m2 = store.addMember({ ...defaultMemberProps(), startNodeId: n2.id, endNodeId: n3.id })
      const connected = store.connectedMembers(n2.id)
      expect(connected).toHaveLength(2)
      expect(connected.map(m => m.id)).toContain(m1.id)
      expect(connected.map(m => m.id)).toContain(m2.id)
    })

    it('connectedMembers returns empty array for isolated node', () => {
      const store = useStructureStore()
      const n = store.addNode({ x: 0, y: 0, support: 'free' })
      expect(store.connectedMembers(n.id)).toEqual([])
    })
  })

  // ── loadSnapshot ─────────────────────────────────────────────────────────────
  describe('loadSnapshot', () => {
    it('replaces nodes and members with snapshot data', () => {
      const store = useStructureStore()
      const snap = {
        nodes: [{ id: 'snap-n1', x: 1, y: 2, support: 'pinned' as const }],
        members: [] as Member[],
        structureType: 'truss' as const,
      }
      store.loadSnapshot(snap)
      expect(store.nodes).toHaveLength(1)
      expect(store.nodes[0].id).toBe('snap-n1')
      expect(store.structureType).toBe('truss')
    })

    it('clears selection after loading snapshot', () => {
      const store = useStructureStore()
      store.addNode({ x: 0, y: 0, support: 'free' })
      store.selectNode(store.nodes[0].id)
      store.loadSnapshot({ nodes: [], members: [], structureType: 'frame' })
      expect(store.selectedNodeIds).toEqual([])
    })
  })
})
