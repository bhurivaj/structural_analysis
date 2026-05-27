import { describe, it, expect } from 'vitest'
import { buildDofMap, totalDof, DOF_PER_NODE } from '@/solver/dof'
import type { StructureNode } from '@/types/structure'

function makeNode(id: string, x = 0, y = 0): StructureNode {
  return { id, x, y, support: 'free' }
}

describe('dof module', () => {
  describe('DOF_PER_NODE constants', () => {
    it('frame has 6 DOF per node (3D: ux,uy,uz,θx,θy,θz)', () => {
      expect(DOF_PER_NODE.frame).toBe(6)
    })

    it('truss has 3 DOF per node (3D: ux,uy,uz)', () => {
      expect(DOF_PER_NODE.truss).toBe(3)
    })
  })

  describe('totalDof', () => {
    it('returns 0 for empty node list', () => {
      expect(totalDof([], 'frame')).toBe(0)
      expect(totalDof([], 'truss')).toBe(0)
    })

    it('returns 6 for a single frame node', () => {
      expect(totalDof([makeNode('n1')], 'frame')).toBe(6)
    })

    it('returns 3 for a single truss node', () => {
      expect(totalDof([makeNode('n1')], 'truss')).toBe(3)
    })

    it('scales correctly for multiple nodes — frame', () => {
      const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
      expect(totalDof(nodes, 'frame')).toBe(18)
    })

    it('scales correctly for multiple nodes — truss', () => {
      const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
      expect(totalDof(nodes, 'truss')).toBe(9)
    })
  })

  describe('buildDofMap', () => {
    it('returns empty map for empty nodes', () => {
      expect(buildDofMap([], 'frame').size).toBe(0)
    })

    it('maps first frame node to DOFs [0..5]', () => {
      const map = buildDofMap([makeNode('n1')], 'frame')
      expect(map.get('n1')).toEqual([0, 1, 2, 3, 4, 5])
    })

    it('maps second frame node to DOFs [6..11]', () => {
      const map = buildDofMap([makeNode('n1'), makeNode('n2')], 'frame')
      expect(map.get('n2')).toEqual([6, 7, 8, 9, 10, 11])
    })

    it('maps first truss node to DOFs [0, 1, 2]', () => {
      const map = buildDofMap([makeNode('n1')], 'truss')
      expect(map.get('n1')).toEqual([0, 1, 2])
    })

    it('maps second truss node to DOFs [3, 4, 5]', () => {
      const map = buildDofMap([makeNode('n1'), makeNode('n2')], 'truss')
      expect(map.get('n2')).toEqual([3, 4, 5])
    })

    it('contains an entry for every node', () => {
      const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')]
      const map = buildDofMap(nodes, 'frame')
      expect(map.size).toBe(4)
      for (const n of nodes) expect(map.has(n.id)).toBe(true)
    })

    it('DOF arrays have correct length for frame (6)', () => {
      const map = buildDofMap([makeNode('x')], 'frame')
      expect(map.get('x')!.length).toBe(6)
    })

    it('DOF arrays have correct length for truss (3)', () => {
      const map = buildDofMap([makeNode('x')], 'truss')
      expect(map.get('x')!.length).toBe(3)
    })

    it('DOFs are contiguous and non-overlapping across nodes', () => {
      const nodes = Array.from({ length: 5 }, (_, i) => makeNode(`n${i}`))
      const map = buildDofMap(nodes, 'frame')
      const allDofs = nodes.flatMap(n => map.get(n.id)!)
      const unique = new Set(allDofs)
      expect(unique.size).toBe(allDofs.length) // no duplicates
      expect(Math.min(...allDofs)).toBe(0)      // starts at 0
    })
  })
})
