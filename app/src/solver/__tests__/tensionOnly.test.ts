import { describe, it, expect } from 'vitest'
import { runFemAnalysis } from '@/solver'
import type { StructureNode, Member } from '@/types/structure'
import type { Load } from '@/types/loads'

describe('Tension-Only Member Solver (Iterative)', () => {
  describe('Simple cable under tension', () => {
    // 2-node structure: A (fixed) -- cable -- B (pinned to provide horizontal constraint)
    // Horizontal load at B → cable in tension → should converge with 1 iteration
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'fixed' },
      { id: 'B', x: 5, y: 0, support: 'pinned' },
    ]
    const members: Member[] = [
      {
        id: 'M1',
        startNodeId: 'A',
        endNodeId: 'B',
        steelProfileId: null,
        E: 200000, // MPa
        A: 100,    // mm²
        I: 0,
        isTruss: true,
        tensionOnly: true,
        label: 'Cable1',
      },
    ]
    const loads: Load[] = [
      {
        id: 'L1',
        type: 'point_load',
        nodeId: 'B',
        fx: -10, // 10 kN horizontal load (tension in cable)
        fy: 0,
      },
    ]

    const result = runFemAnalysis(nodes, members, loads, 'truss')

    it('should succeed', () => {
      expect(result.success).toBe(true)
    })

    it('cable should be in result', () => {
      const mr = result.memberResults.find(m => m.memberId === 'M1')
      expect(mr).toBeDefined()
    })

    it('should complete analysis without errors', () => {
      expect(result.error).toBeUndefined()
    })
  })

  describe('Cable member results structure', () => {
    // Verify that cable member results include all required fields
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'fixed' },
      { id: 'B', x: 5, y: 0, support: 'pinned' },
    ]
    const members: Member[] = [
      {
        id: 'M1',
        startNodeId: 'A',
        endNodeId: 'B',
        steelProfileId: null,
        E: 200000,
        A: 100,
        I: 0,
        isTruss: true,
        tensionOnly: true,
        label: 'Cable',
      },
    ]
    const loads: Load[] = [
      {
        id: 'L1',
        type: 'point_load',
        nodeId: 'B',
        fx: 0,
        fy: -10,
      },
    ]

    const result = runFemAnalysis(nodes, members, loads, 'truss')

    it('should successfully analyze cable member', () => {
      expect(result.success).toBe(true)
    })

    it('cable member should have result with all force arrays', () => {
      const mr = result.memberResults.find(m => m.memberId === 'M1')
      expect(mr).toBeDefined()
      expect(mr!.N).toBeDefined()
      expect(mr!.N.length).toBeGreaterThan(0)
      expect(mr!.V).toBeDefined()
      expect(mr!.V.length).toBeGreaterThan(0)
      expect(mr!.M).toBeDefined()
      expect(mr!.M.length).toBeGreaterThan(0)
      expect(mr!.endForces).toBeDefined()
      expect(mr!.endForces.length).toBe(6)
    })
  })

  describe('Multiple tension-only members are all included in results', () => {
    // A (fixed) -- cable 1 -- B (pinned) -- cable 2 -- C (pinned)
    // Both cables should be in the result (even if slack)
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'fixed' },
      { id: 'B', x: 5, y: 0, support: 'pinned' },
      { id: 'C', x: 10, y: 0, support: 'pinned' },
    ]
    const members: Member[] = [
      {
        id: 'M1',
        startNodeId: 'A',
        endNodeId: 'B',
        steelProfileId: null,
        E: 200000,
        A: 50,
        I: 0,
        isTruss: true,
        tensionOnly: true,
        label: 'Cable1',
      },
      {
        id: 'M2',
        startNodeId: 'B',
        endNodeId: 'C',
        steelProfileId: null,
        E: 200000,
        A: 50,
        I: 0,
        isTruss: true,
        tensionOnly: true,
        label: 'Cable2',
      },
    ]
    const loads: Load[] = [
      {
        id: 'L1',
        type: 'point_load',
        nodeId: 'B',
        fx: 0,
        fy: -10, // 10 kN downward at B
      },
    ]

    const result = runFemAnalysis(nodes, members, loads, 'truss')

    it('should succeed', () => {
      expect(result.success).toBe(true)
    })

    it('both members should be in result (even if one is slack)', () => {
      expect(result.memberResults).toHaveLength(2)
      expect(result.memberResults.map(m => m.memberId)).toContain('M1')
      expect(result.memberResults.map(m => m.memberId)).toContain('M2')
    })
  })

  describe('Convergence verification', () => {
    // Verify normal convergence behavior in simple case
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'fixed' },
      { id: 'B', x: 5, y: 0, support: 'pinned' },
    ]
    const members: Member[] = [
      {
        id: 'M1',
        startNodeId: 'A',
        endNodeId: 'B',
        steelProfileId: null,
        E: 200000,
        A: 100,
        I: 0,
        isTruss: true,
        tensionOnly: true,
      },
    ]
    const loads: Load[] = [
      { id: 'L1', type: 'point_load', nodeId: 'B', fx: -5, fy: 0 },
    ]

    const result = runFemAnalysis(nodes, members, loads, 'truss')

    it('should converge successfully', () => {
      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('result should include member results', () => {
      expect(result.memberResults.length).toBeGreaterThan(0)
    })

    it('tensionOnly member should be processed', () => {
      const mr = result.memberResults.find(m => m.memberId === 'M1')
      expect(mr).toBeDefined()
    })
  })
})
