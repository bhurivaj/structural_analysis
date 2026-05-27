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

// 3D frame DOF layout per node: [ux=0, uy=1, uz=2, θx=3, θy=4, θz=5]
// 2-node frame: node A = [0..5], node B = [6..11], nDof = 12
// 2-node truss: node A = [0..2], node B = [3..5], nDof = 6

// ── tests ─────────────────────────────────────────────────────────────────────
describe('assembleForceVector', () => {
  describe('empty loads', () => {
    const nodes = [makeNode('A', 0, 0), makeNode('B', 5, 0)]
    const dofMap = buildDofMap(nodes, 'frame')

    it('returns all-zero vector when there are no loads', () => {
      const F = assembleForceVector([], nodes, [], dofMap, 'frame', 12)
      expect(F).toEqual(new Array(12).fill(0))
    })

    it('returns vector of correct length for frame (nDof)', () => {
      const F = assembleForceVector([], nodes, [], dofMap, 'frame', 12)
      expect(F.length).toBe(12)
    })

    it('returns vector of correct length for truss', () => {
      const dofMapT = buildDofMap(nodes, 'truss')
      const F = assembleForceVector([], nodes, [], dofMapT, 'truss', 6)
      expect(F.length).toBe(6)
    })
  })

  describe('point loads', () => {
    const nodes = [makeNode('A', 0, 0), makeNode('B', 5, 0)]
    const dofMap = buildDofMap(nodes, 'frame')

    it('adds fx to correct DOF (node A DOF[0])', () => {
      const load: Load = { id: 'L1', type: 'point_load', nodeId: 'A', fx: 10, fy: 0 }
      const F = assembleForceVector([load], nodes, [], dofMap, 'frame', 12)
      expect(F[0]).toBe(10)  // node A ux
      expect(F[1]).toBe(0)
      expect(F[6]).toBe(0)   // node B untouched
    })

    it('adds fy to correct DOF (node A DOF[1])', () => {
      const load: Load = { id: 'L1', type: 'point_load', nodeId: 'A', fx: 0, fy: -20 }
      const F = assembleForceVector([load], nodes, [], dofMap, 'frame', 12)
      expect(F[1]).toBe(-20)
      expect(F[0]).toBe(0)
    })

    it('applies load to second node correctly (B DOF[0]=6, DOF[1]=7)', () => {
      const load: Load = { id: 'L1', type: 'point_load', nodeId: 'B', fx: 5, fy: -10 }
      const F = assembleForceVector([load], nodes, [], dofMap, 'frame', 12)
      expect(F[6]).toBe(5)   // node B ux
      expect(F[7]).toBe(-10) // node B uy
    })

    it('applies fz to uz DOF (index 2 for node A)', () => {
      const load: Load = { id: 'L1', type: 'point_load', nodeId: 'A', fx: 0, fy: 0, fz: 7 }
      const F = assembleForceVector([load], nodes, [], dofMap, 'frame', 12)
      expect(F[2]).toBe(7)   // node A uz
    })

    it('superimposes multiple point loads at the same node', () => {
      const loads: Load[] = [
        { id: 'L1', type: 'point_load', nodeId: 'A', fx: 3, fy: 0 },
        { id: 'L2', type: 'point_load', nodeId: 'A', fx: 7, fy: -5 },
      ]
      const F = assembleForceVector(loads, nodes, [], dofMap, 'frame', 12)
      expect(F[0]).toBe(10)  // 3 + 7
      expect(F[1]).toBe(-5)
    })

    it('ignores loads referencing unknown nodeId', () => {
      const load: Load = { id: 'L1', type: 'point_load', nodeId: 'UNKNOWN', fx: 100, fy: 100 }
      const F = assembleForceVector([load], nodes, [], dofMap, 'frame', 12)
      expect(F.every(v => v === 0)).toBe(true)
    })
  })

  describe('moment loads', () => {
    const nodes = [makeNode('A', 0, 0), makeNode('B', 5, 0)]
    const dofMap = buildDofMap(nodes, 'frame')

    it('adds mz to θz DOF[5] in frame mode (node A)', () => {
      const load: Load = { id: 'L1', type: 'moment', nodeId: 'A', mz: 15 }
      const F = assembleForceVector([load], nodes, [], dofMap, 'frame', 12)
      expect(F[5]).toBe(15)  // node A θz (DOF index 5 in 6-DOF frame)
      expect(F[0]).toBe(0)
      expect(F[1]).toBe(0)
    })

    it('ignores moment loads in truss mode (no rotational DOF)', () => {
      const dofMapT = buildDofMap(nodes, 'truss')
      const load: Load = { id: 'L1', type: 'moment', nodeId: 'A', mz: 15 }
      const F = assembleForceVector([load], nodes, [], dofMapT, 'truss', 6)
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
      const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 12)
      // UDL of 10 kN/m over 4 m → total 40 kN, split equally → 20 kN each
      expect(F[1]).toBeCloseTo(20, 4)  // node A uy
      expect(F[7]).toBeCloseTo(20, 4)  // node B uy
    })

    it('fixed-end moments are equal and opposite for UDL', () => {
      const L = 4
      const w = 10
      const load: Load = { id: 'L1', type: 'distributed_load', memberId: 'M1', w1: w, w2: w, direction: 'local_y' }
      const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 12)
      // M1 = wL²/12 (positive), M2 = -wL²/12
      const expectedM = w * L * L / 12
      expect(F[5]).toBeCloseTo(expectedM, 3)    // node A θz
      expect(F[11]).toBeCloseTo(-expectedM, 3)  // node B θz
    })

    it('ignores distributed load for unknown member id', () => {
      const load: Load = { id: 'L1', type: 'distributed_load', memberId: 'UNKNOWN', w1: 10, w2: 10, direction: 'local_y' }
      const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 12)
      expect(F.every(v => v === 0)).toBe(true)
    })

    it('global_y direction applies vertical forces', () => {
      const load: Load = { id: 'L1', type: 'distributed_load', memberId: 'M1', w1: 5, w2: 5, direction: 'global_y' }
      const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 12)
      expect(F[1]).toBeGreaterThan(0)  // fy at A
      expect(F[7]).toBeGreaterThan(0)  // fy at B
      expect(F[0]).toBeCloseTo(0, 5)   // fx at A
    })

    describe('trapezoidal distributed load (w1 ≠ w2)', () => {
      // Fixed-fixed beam, L=4m, w1=10 kN/m, w2=30 kN/m
      // Correct fixed-end forces (superposition UDL(w1) + triangular(0→dw)):
      //   Fy1 = (7·w1 + 3·w2)·L/20 = (70+90)·4/20 = 32 kN
      //   Fy2 = (3·w1 + 7·w2)·L/20 = (30+210)·4/20 = 48 kN
      //   M1  = w1·L²/12 + dw·L²/30 = 10·16/12 + 20·16/30 = 13.33 + 10.67 = 24 kN·m
      //   M2  = -(w1·L²/12 + dw·L²/20) = -(13.33 + 16) = -29.33 kN·m
      const w1 = 10, w2 = 30, L = 4
      const dw = w2 - w1
      const load: Load = { id: 'L1', type: 'distributed_load', memberId: 'M1', w1, w2, direction: 'local_y' }

      it('Fy1 matches (7w1+3w2)L/20', () => {
        const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 12)
        const expected = (7 * w1 + 3 * w2) * L / 20   // 32 kN
        expect(F[1]).toBeCloseTo(expected, 3)
      })

      it('Fy2 matches (3w1+7w2)L/20', () => {
        const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 12)
        const expected = (3 * w1 + 7 * w2) * L / 20   // 48 kN
        expect(F[7]).toBeCloseTo(expected, 3)
      })

      it('reactions sum to total load (w1+w2)/2·L', () => {
        const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 12)
        expect(F[1] + F[7]).toBeCloseTo((w1 + w2) / 2 * L, 3)  // 80 kN
      })

      it('M1 matches w1·L²/12 + dw·L²/30', () => {
        const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 12)
        const expected = w1 * L * L / 12 + dw * L * L / 30  // 24 kN·m
        expect(F[5]).toBeCloseTo(expected, 3)
      })

      it('M2 matches -(w1·L²/12 + dw·L²/20)', () => {
        const F = assembleForceVector([load], nodes, members, dofMap, 'frame', 12)
        const expected = -(w1 * L * L / 12 + dw * L * L / 20)  // -29.33 kN·m
        expect(F[11]).toBeCloseTo(expected, 3)
      })
    })
  })
})
