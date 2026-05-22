import { describe, it, expect } from 'vitest'
import { performDesignCheck } from '@/utils/designCheck'
import type { Member, StructureNode } from '@/types/structure'
import type { MemberResult } from '@/types/solver'

describe('Design Check — Tension-Only Members', () => {
  const nodes = new Map<string, StructureNode>([
    ['A', { id: 'A', x: 0, y: 0, support: 'fixed' }],
    ['B', { id: 'B', x: 5, y: 0, support: 'free' }],
  ])

  describe('Cable with tensile force only', () => {
    const members = new Map<string, Member>([
      [
        'M1',
        {
          id: 'M1',
          startNodeId: 'A',
          endNodeId: 'B',
          steelProfileId: null,
          E: 200000,
          A: 100, // mm²
          I: 0,
          isTruss: true,
          tensionOnly: true,
          label: 'Cable',
        },
      ],
    ])

    const memberResults: MemberResult[] = [
      {
        memberId: 'M1',
        stations: [0, 0.5, 1],
        N: [50, 50, 50], // 50 kN tension
        V: [0, 0, 0],
        M: [0, 0, 0],
        endForces: [50, 0, 0, 50, 0, 0],
      },
    ]

    const steelProfiles = new Map()
    const defaultFy = 250 // MPa

    const results = performDesignCheck(
      memberResults,
      members,
      nodes,
      steelProfiles,
      defaultFy
    )

    it('should return 1 result for 1 member', () => {
      expect(results).toHaveLength(1)
    })

    it('should have UR_axial > 0 (from tensile check)', () => {
      expect(results[0].UR_axial).toBeGreaterThan(0)
      // UR = N / (φ × Fy × A) = 50000 / (0.9 × 250 × 100) = 50000 / 22500 ≈ 2.22
      expect(results[0].UR_axial).toBeCloseTo(2.22, 1)
    })

    it('should have UR_bending = 0 (cable ignores bending)', () => {
      expect(results[0].UR_bending).toBe(0)
    })

    it('should have UR_shear = 0 (cable ignores shear)', () => {
      expect(results[0].UR_shear).toBe(0)
    })

    it('UR_combined should equal UR_axial (no bending/shear)', () => {
      expect(results[0].UR_combined).toBe(results[0].UR_axial)
    })

    it('should FAIL status (UR > 1.0)', () => {
      expect(results[0].status).toBe('FAIL')
    })
  })

  describe('Cable with zero force (slack)', () => {
    const members = new Map<string, Member>([
      [
        'M1',
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
          label: 'SlackCable',
        },
      ],
    ])

    const memberResults: MemberResult[] = [
      {
        memberId: 'M1',
        stations: [0, 0.5, 1],
        N: [0, 0, 0], // slack: zero force
        V: [0, 0, 0],
        M: [0, 0, 0],
        endForces: [0, 0, 0, 0, 0, 0],
      },
    ]

    const steelProfiles = new Map()
    const defaultFy = 250

    const results = performDesignCheck(
      memberResults,
      members,
      nodes,
      steelProfiles,
      defaultFy
    )

    it('should have UR_axial = 0', () => {
      expect(results[0].UR_axial).toBe(0)
    })

    it('should have UR_combined = 0', () => {
      expect(results[0].UR_combined).toBe(0)
    })

    it('should PASS status (UR = 0)', () => {
      expect(results[0].status).toBe('PASS')
    })
  })

  describe('Cable vs Normal Truss Member comparison', () => {
    const members = new Map<string, Member>([
      [
        'M1',
        {
          id: 'M1',
          startNodeId: 'A',
          endNodeId: 'B',
          steelProfileId: null,
          E: 200000,
          A: 100,
          I: 0,
          isTruss: true,
          tensionOnly: true, // ← CABLE
          label: 'Cable',
        },
      ],
      [
        'M2',
        {
          id: 'M2',
          startNodeId: 'A',
          endNodeId: 'B',
          steelProfileId: null,
          E: 200000,
          A: 100,
          I: 0,
          isTruss: true,
          tensionOnly: false, // ← NORMAL TRUSS
          label: 'TrussMember',
        },
      ],
    ])

    // Same forces for both
    const memberResults: MemberResult[] = [
      {
        memberId: 'M1',
        stations: [0, 0.5, 1],
        N: [50, 50, 50],
        V: [0, 0, 0],
        M: [0, 0, 0],
        endForces: [50, 0, 0, 50, 0, 0],
      },
      {
        memberId: 'M2',
        stations: [0, 0.5, 1],
        N: [50, 50, 50],
        V: [0, 0, 0],
        M: [0, 0, 0],
        endForces: [50, 0, 0, 50, 0, 0],
      },
    ]

    const steelProfiles = new Map()
    const defaultFy = 250

    const results = performDesignCheck(
      memberResults,
      members,
      nodes,
      steelProfiles,
      defaultFy
    )

    it('cable and normal member should have same UR_axial', () => {
      expect(results[0].UR_axial).toBeCloseTo(results[1].UR_axial, 5)
    })

    it('cable should have UR_bending = 0, normal member UR_bending = 0 (no moment)', () => {
      expect(results[0].UR_bending).toBe(0)
      expect(results[1].UR_bending).toBe(0)
    })

    it('cable UR_combined should equal UR_axial only', () => {
      expect(results[0].UR_combined).toBe(results[0].UR_axial)
    })
  })

  describe('Cable with moment (should be ignored)', () => {
    const members = new Map<string, Member>([
      [
        'M1',
        {
          id: 'M1',
          startNodeId: 'A',
          endNodeId: 'B',
          steelProfileId: null,
          E: 200000,
          A: 100,
          I: 100,
          isTruss: true,
          tensionOnly: true,
          label: 'Cable',
        },
      ],
    ])

    // Cable with unexpected moment (shouldn't happen in practice)
    const memberResults: MemberResult[] = [
      {
        memberId: 'M1',
        stations: [0, 0.5, 1],
        N: [30, 30, 30],
        V: [5, 5, 5],
        M: [100, 100, 100], // ← ignored for cable
        endForces: [30, 5, 100, 30, 5, 100],
      },
    ]

    const steelProfiles = new Map()
    const defaultFy = 250

    const results = performDesignCheck(
      memberResults,
      members,
      nodes,
      steelProfiles,
      defaultFy
    )

    it('should ignore moment and shear in UR calculation', () => {
      expect(results[0].UR_bending).toBe(0)
      expect(results[0].UR_shear).toBe(0)
    })

    it('UR_combined should be UR_axial only (not affected by M/V)', () => {
      expect(results[0].UR_combined).toBe(results[0].UR_axial)
    })
  })
})
