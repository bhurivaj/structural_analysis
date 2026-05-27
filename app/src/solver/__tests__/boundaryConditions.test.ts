import { describe, it, expect } from 'vitest'
import { applyBoundaryConditions } from '@/solver/boundaryConditions'
import { buildDofMap } from '@/solver/dof'
import type { StructureNode } from '@/types/structure'

function makeIdentityK(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  )
}

function makeF(n: number, val = 1): number[] {
  return new Array(n).fill(val)
}

// 3D DOF layout — frame node: [ux=0, uy=1, uz=2, θx=3, θy=4, θz=5]
// 2 frame nodes → nDof=12: A=[0..5], B=[6..11]
// 2 truss nodes → nDof=6:  A=[0..2], B=[3..5]

describe('applyBoundaryConditions', () => {
  describe('frame structure — fixed support', () => {
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'fixed' },
      { id: 'B', x: 5, y: 0, support: 'free' },
    ]
    const dofMap = buildDofMap(nodes, 'frame')
    const n = 12
    const K = makeIdentityK(n)
    const F = makeF(n)

    const { Kbc, Fbc } = applyBoundaryConditions(K, F, nodes, dofMap, 'frame')

    it('does not mutate the original K', () => {
      expect(K[0][0]).toBe(1)
    })

    it('does not mutate the original F', () => {
      expect(F[0]).toBe(1)
    })

    it('constrains all 6 DOFs of the fixed frame node', () => {
      // Fixed node A → DOFs 0..5 (ux,uy,uz,θx,θy,θz)
      for (let i = 0; i < 6; i++) {
        expect(Fbc[i]).toBe(0)
        expect(Kbc[i][i]).toBeGreaterThan(1e10)
      }
    })

    it('leaves free node DOFs unchanged', () => {
      // Free node B → DOFs 6..11
      for (let i = 6; i < 12; i++) {
        expect(Fbc[i]).toBe(1)
        expect(Kbc[i][i]).toBe(1)
      }
    })
  })

  describe('frame structure — pinned support', () => {
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'pinned' },
      { id: 'B', x: 3, y: 0, support: 'free' },
    ]
    const dofMap = buildDofMap(nodes, 'frame')
    const n = 12
    const K = makeIdentityK(n)
    const F = makeF(n)

    const { Kbc, Fbc } = applyBoundaryConditions(K, F, nodes, dofMap, 'frame')

    it('constrains all translation DOFs 0, 1, 2 (ux, uy, uz)', () => {
      expect(Fbc[0]).toBe(0)
      expect(Fbc[1]).toBe(0)
      expect(Fbc[2]).toBe(0)
    })

    it('K[0][0], K[1][1], K[2][2] are penalized', () => {
      expect(Kbc[0][0]).toBeGreaterThan(1e10)
      expect(Kbc[1][1]).toBeGreaterThan(1e10)
      expect(Kbc[2][2]).toBeGreaterThan(1e10)
    })

    it('rotation DOFs 3,4,5 remain free (pinned allows rotation)', () => {
      expect(Kbc[3][3]).toBe(1)
      expect(Kbc[4][4]).toBe(1)
      expect(Kbc[5][5]).toBe(1)
      expect(Fbc[3]).toBe(1)
      expect(Fbc[4]).toBe(1)
      expect(Fbc[5]).toBe(1)
    })
  })

  describe('frame structure — roller support (y-axis)', () => {
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'roller', rollerAxis: 'y' },
      { id: 'B', x: 5, y: 0, support: 'free' },
    ]
    const dofMap = buildDofMap(nodes, 'frame')
    const n = 12
    const K = makeIdentityK(n)
    const F = makeF(n)

    const { Kbc, Fbc } = applyBoundaryConditions(K, F, nodes, dofMap, 'frame')

    it('constrains only DOF 1 (y-translation)', () => {
      expect(Fbc[1]).toBe(0)
      expect(Kbc[1][1]).toBeGreaterThan(1e10)
    })

    it('leaves DOF 0 (x-translation) free', () => {
      expect(Fbc[0]).toBe(1)
      expect(Kbc[0][0]).toBe(1)
    })

    it('leaves DOF 2 (z-translation) free', () => {
      expect(Fbc[2]).toBe(1)
      expect(Kbc[2][2]).toBe(1)
    })

    it('leaves DOF 5 (θz rotation) free', () => {
      expect(Fbc[5]).toBe(1)
      expect(Kbc[5][5]).toBe(1)
    })
  })

  describe('frame structure — roller support (x-axis)', () => {
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'roller', rollerAxis: 'x' },
      { id: 'B', x: 5, y: 0, support: 'free' },
    ]
    const dofMap = buildDofMap(nodes, 'frame')
    const K = makeIdentityK(12)
    const F = makeF(12)

    const { Kbc, Fbc } = applyBoundaryConditions(K, F, nodes, dofMap, 'frame')

    it('constrains only DOF 0 (x-translation)', () => {
      expect(Fbc[0]).toBe(0)
      expect(Kbc[0][0]).toBeGreaterThan(1e10)
    })

    it('leaves DOF 1 (y-translation) free', () => {
      expect(Fbc[1]).toBe(1)
      expect(Kbc[1][1]).toBe(1)
    })
  })

  describe('frame structure — roller support (z-axis)', () => {
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'roller', rollerAxis: 'z' },
      { id: 'B', x: 5, y: 0, support: 'free' },
    ]
    const dofMap = buildDofMap(nodes, 'frame')
    const K = makeIdentityK(12)
    const F = makeF(12)

    const { Kbc, Fbc } = applyBoundaryConditions(K, F, nodes, dofMap, 'frame')

    it('constrains only DOF 2 (z-translation)', () => {
      expect(Fbc[2]).toBe(0)
      expect(Kbc[2][2]).toBeGreaterThan(1e10)
    })

    it('leaves DOF 1 (y-translation) free', () => {
      expect(Fbc[1]).toBe(1)
      expect(Kbc[1][1]).toBe(1)
    })
  })

  describe('truss structure — pinned support', () => {
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'pinned' },
      { id: 'B', x: 4, y: 0, support: 'free' },
    ]
    const dofMap = buildDofMap(nodes, 'truss')
    const n = 6
    const K = makeIdentityK(n)
    const F = makeF(n)

    const { Kbc, Fbc } = applyBoundaryConditions(K, F, nodes, dofMap, 'truss')

    it('constrains DOFs 0, 1, 2 for truss pinned node (ux,uy,uz)', () => {
      expect(Fbc[0]).toBe(0)
      expect(Fbc[1]).toBe(0)
      expect(Fbc[2]).toBe(0)
    })

    it('leaves free node DOFs unchanged (DOFs 3,4,5)', () => {
      expect(Fbc[3]).toBe(1)
      expect(Fbc[4]).toBe(1)
      expect(Fbc[5]).toBe(1)
    })
  })

  describe('free support — no constraints applied', () => {
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'free' },
      { id: 'B', x: 1, y: 0, support: 'free' },
    ]
    const dofMap = buildDofMap(nodes, 'frame')
    const n = 12
    const K = makeIdentityK(n)
    const F = makeF(n)

    const { Kbc, Fbc } = applyBoundaryConditions(K, F, nodes, dofMap, 'frame')

    it('does not modify K diagonal for free nodes', () => {
      for (let i = 0; i < n; i++) expect(Kbc[i][i]).toBe(1)
    })

    it('does not modify F for free nodes', () => {
      for (let i = 0; i < n; i++) expect(Fbc[i]).toBe(1)
    })
  })

  describe('penalty factor magnitude', () => {
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'fixed' },
    ]
    const dofMap = buildDofMap(nodes, 'frame')
    const K = makeIdentityK(6)
    const F = makeF(6)

    const { Kbc } = applyBoundaryConditions(K, F, nodes, dofMap, 'frame')

    it('penalty is 1e12 times original diagonal', () => {
      expect(Kbc[0][0]).toBeCloseTo(1e12, 0)
    })
  })
})
