import { describe, it, expect } from 'vitest'
import { assembleForceVector } from '@/solver/loadVector'
import { buildDofMap } from '@/solver/dof'
import type { StructureNode, Member } from '@/types/structure'
import type { Load } from '@/types/loads'

// ── helpers ──────────────────────────────────────────────────────────────────
function makeNode(id: string, x: number, y: number): StructureNode {
  return { id, x, y, support: 'free' }
}

function makeMember(id: string, startNodeId: string, endNodeId: string): Member {
  return {
    id,
    startNodeId,
    endNodeId,
    steelProfileId: null,
    E: 200000,   // MPa
    A: 6353,     // mm²
    I: 4.72e7,   // mm⁴
    isTruss: false,
  }
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('assembleForceVector', () => {
  describe('empty loads', () => {
    const nodes = [makeNode('A', 0, 0), makeNode('B', 5, 0)]
    const dofMap = buildDofMap(nodes, 'frame')

    it('returns all-zero vector when there are no loads', () => {
      const F = assembleForceVector([], nodes, [], dofMap, 'frame', 6)
      expect(F).toEqual(new Array(6).fill(0))
    })

    it('returns vector of correct length for frame (nDof)', () => {
      const F = assembleForceVector([], nodes, [], dofMap, 'frame', 6)
      expect(F.length).toBe(6)
    })

    it('returns vector of correct length for truss', () => {
      const dofMapT = buildDofMap(nodes, 'truss')
      const F = assembleForceVector([], nodes, [], dofMapT, 'truss', 4)
      expect(F.length).toBe(4)
    })
  })

  describe('point loads', () => {
    const nodes = [makeNode('A', 0, 0), makeNode('B', 5, 0)]
    const dofMap = buildDofMap(nodes, 'frame')

    it('adds fx to correct DOF (node DOF[0])', () => {
      const load: Load = { id: 'L1', type: 'point_load', nodeId: 'A', fx: 10, fy: 0 }
      const F = assembleForceVector([load], nodes, [], dofMap, 'frame', 6)
      expect(F[0]).toBe(10)  // node A DOF 0
      expect(F[1]).toBe(0)
      expect(F[3]).toBe(0)   // node B untouched
    })

    it('adds fy to correct DOF (node DOF[1])', () => {
      const load: Load = { id: 'L1', type: 'point_load', nodeId: 'A', fx: 0, fy: -20 }
      const F = assembleForceVector([load], nodes, [], dofMap, 'frame', 6)
      expect(F[1]).toBe(-20)
      expect(F[0]).toBe(0)
    })

    it('applies load to second node correctly', () => {
      const load: Load = { id: 'L1', type: 'point_load', nodeId: 'B', fx: 5, fy: -10 }
      const F = assembleForceVector([load], nodes, [], dofMap, 'frame', 6)
      expect(F[3]).toBe(5)   // node B DOF 0
      expect(F[4]).toBe(-10) // node B DOF 1
    })

    it('superimposes multiple point loads at the same node', () => {
      const loads: Load[] = [
        { id: 'L1', type: 'point_load', nodeId: 'A', fx: 3, fy: 0 },
        { id: 'L2', type: 'point_load', nodeId: 'A', fx: 7, fy: -5 },
      ]
      const F = assembleForceVector(loads, nodes, [], dofMap, 'frame', 6)
      expect(F[0]).toBe(10)  // 3 + 7
      expect(F[1]).toBe(-5)
    })

    it('ignores loads referencing unknown nodeId', () => {
      const load: Load = { id: 'L1', type: 'point_load', nodeId: 'UNKNOWN', fx: 100, fy: 100 }
      const F = assembleForceVector([load], nodes, [], dofMap, 'frame', 6)
      expect(F.every(v => v === 0)).toBe(true)
    })
  })

  describe('moment loads', () => {
    const nodes = [makeNode('A', 0, 0), makeNode('B', 5, 0)]
    const dofMap = buildDofMap(nodes, 'frame')

    it('adds mz to rotation DOF[2] in frame mode', () => {
      const load: Load = { id: 'L1', type: 'moment', nodeId: 'A', mz: 15 }
      const F = assembleForceVector([load], nodes, [], dofMap, 'frame', 6)
      expect(F[2]).toBe(15)  // node A DOF 2 (rotation)
      expect(F[0]).toBe(0)
      expect(F[1]).toBe(0)
    })

    it('ignores moment loads in truss mode (no rotational DOF)', () => {
      const dofMapT = buildDofMap(nodes, 'truss')
      const load: Load = { id: 'L1', type: 'moment', nodeId: 'A', mz: 15 }
      const F = assembleForceVector([load], nodes, [], dofMapT, 'truss', 4)
      expect(F.every(v => v === 0)).toBe(true)
    })
  })

  describe('distributed loads', () => {
    const nodeA = makeNode('A', 0, 0)
    const nodeB = makeNode('B', 4, 0) // 4 m horizontal member
    const nodes = [nodeA, nodeB]
    const members = [makeMember('M1', 'A', 'B')]
    const dofMap = buildDofMap(nodes, 'frame')

    it('produces non-zero force vector for UDL on a horizontal member', () => {
      const load: Load = { id: 'L1', type: 'distributed_load', memberId: 'M1', w1: 10, w2: 10, direction: 'local_y' }
      const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 6)
      // UDL of 10 kN/m over 4 m → total 40 kN, split equally → 20 kN each
      expect(F[1]).toBeCloseTo(20, 4)  // node A fy
      expect(F[4]).toBeCloseTo(20, 4)  // node B fy
    })

    it('fixed-end moments are equal and opposite for UDL', () => {
      const L = 4
      const w = 10
      const load: Load = { id: 'L1', type: 'distributed_load', memberId: 'M1', w1: w, w2: w, direction: 'local_y' }
      const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 6)
      // M1 = wL²/12 (positive), M2 = -wL²/12
      const expectedM = w * L * L / 12
      expect(F[2]).toBeCloseTo(expectedM, 3)   // node A moment
      expect(F[5]).toBeCloseTo(-expectedM, 3)  // node B moment
    })

    it('ignores distributed load for unknown member id', () => {
      const load: Load = { id: 'L1', type: 'distributed_load', memberId: 'UNKNOWN', w1: 10, w2: 10, direction: 'local_y' }
      const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 6)
      expect(F.every(v => v === 0)).toBe(true)
    })

    it('global_y direction applies vertical forces without moments', () => {
      const load: Load = { id: 'L1', type: 'distributed_load', memberId: 'M1', w1: 5, w2: 5, direction: 'global_y' }
      const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 6)
      // global_y for a horizontal member → should apply vertical forces
      expect(F[1]).toBeGreaterThan(0)  // fy at A
      expect(F[4]).toBeGreaterThan(0)  // fy at B
      // global_y path in code doesn't add moments
      expect(F[0]).toBeCloseTo(0, 5)   // fx at A
    })
  })
})
