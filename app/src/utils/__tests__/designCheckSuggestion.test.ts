import { describe, it, expect } from 'vitest'
import { performDesignCheck } from '@/utils/designCheck'
import type { Member, StructureNode } from '@/types/structure'
import type { MemberResult } from '@/types/solver'
import type { SteelProfile } from '@/types/steel'

// ─── helpers ─────────────────────────────────────────────────────────────────

const node1: StructureNode = { id: 'n1', x: 0, y: 0, support: 'pinned', label: 'N1' }
const node2: StructureNode = { id: 'n2', x: 3, y: 0, support: 'free', label: 'N2' }
const nodes = new Map([['n1', node1], ['n2', node2]])

const baseMember: Member = {
  id: 'm1',
  startNodeId: 'n1',
  endNodeId: 'n2',
  E: 200000,
  A: 6000,
  I: 47000000,
  isTruss: false,
  label: 'M1',
}

function makeMR(N: number[], V: number[], M: number[]): MemberResult {
  return { memberId: 'm1', stations: [0, 0.5, 1], N, V, M, endForces: [0, 0, 0, 0, 0, 0] }
}

function makeProfile(overrides: Partial<SteelProfile> = {}): SteelProfile {
  return {
    id: 'p1',
    standard: 'TIS',
    profileClass: 'H',
    designation: 'TestH',
    d: 200, bf: 100, tf: 8, tw: 6, r: 11,
    A: 6000, Ix: 47000000, Iy: 2000000,
    Sx: 470000, Zx: 520000, rx: 88, ry: 0,
    mass: 47, E: 200000, Fy: 250,
    ...overrides,
  }
}

function check(mr: MemberResult, profileOverrides: Partial<SteelProfile> = {}) {
  const profile = makeProfile(profileOverrides)
  const member: Member = { ...baseMember, steelProfileId: profile.id }
  return performDesignCheck(
    [mr],
    new Map([[member.id, member]]),
    nodes,
    new Map([[profile.id, profile]]),
    250,
  )[0]
}

// ─── getSuggestion branch coverage ───────────────────────────────────────────
// getSuggestion is private; accessed via the `suggestion` field of performDesignCheck.

describe('getSuggestion — PASS', () => {
  it('returns safety message when UR_combined < 0.8', () => {
    // Tiny forces → safe structure
    const result = check(makeMR([0.1, 0.1, 0.1], [0.05, 0.05, 0.05], [0.01, 0.01, 0.01]))
    expect(result.status).toBe('PASS')
    expect(result.suggestion).toBe('โครงสร้างอยู่ในเกณฑ์ปลอดภัย')
  })
})

describe('getSuggestion — MARGINAL', () => {
  it('returns near-limit message when 0.8 ≤ UR_combined < 1.0', () => {
    // UR_bending ≈ 0.85 with M = 18 kN·m, Sx = 100000mm³, no LTB (ry=0 → full capacity)
    // phi_Mn = 0.9*250*100000 = 22500000 N·mm = 22.5 kN·m → UR_bending = 18/22.5 = 0.8
    const result = check(
      makeMR([0, 0, 0], [0, 0, 0], [18, 18, 18]),
      { Sx: 100000, d: 0, tw: 0, Iy: 0 }, // ry=0 → no LTB branch, Av=0.6*A → tiny shear UR
    )
    expect(result.status).toBe('MARGINAL')
    expect(result.suggestion).toContain('ใกล้ถึงขีดจำกัด')
  })
})

describe('getSuggestion — FAIL: shear dominates', () => {
  it('recommends increasing web thickness when UR_shear > max(UR_axial, UR_bending)', () => {
    // Very small shear area: d=50, tw=3 → Av=150mm²
    // Fy=250, phi_Vn = 0.6*250*150 = 22500N = 22.5kN
    // V = 100kN → UR_shear = 100000/22500 ≈ 4.44 (FAIL)
    // Huge A and Sx → UR_axial≈0, UR_bending≈0
    const result = check(
      makeMR([0.1, 0.1, 0.1], [100, 100, 100], [0.01, 0.01, 0.01]),
      { d: 50, tw: 3, A: 5000000, Sx: 1e10, Iy: 1e12 },
    )
    expect(result.status).toBe('FAIL')
    expect(result.UR_shear).toBeGreaterThan(result.UR_axial)
    expect(result.UR_shear).toBeGreaterThan(result.UR_bending)
    expect(result.suggestion).toContain('web thickness')
  })
})

describe('getSuggestion — FAIL: axial dominates', () => {
  it('recommends increasing cross-section area when UR_axial > 1.0 and UR_bending ≤ 1.0', () => {
    // Tiny A, huge N (tension), no moment → UR_axial >> 1, UR_bending = 0
    // A=50mm², N=500kN → phi_Pn = 0.9*250*50 = 11250N = 11.25kN → UR_axial ≈ 44.4
    // Sx=0 → UR_bending = 0; d=0, tw=0 → Av=0.6*50=30, V=0 → UR_shear=0
    const result = check(
      makeMR([500, 500, 500], [0, 0, 0], [0, 0, 0]),
      { A: 50, Sx: 0, d: 0, tw: 0, Iy: 0 },
    )
    expect(result.status).toBe('FAIL')
    expect(result.UR_axial).toBeGreaterThan(1.0)
    expect(result.UR_bending).toBeLessThanOrEqual(1.0)
    expect(result.suggestion).toContain('Cross-section Area')
  })
})

describe('getSuggestion — FAIL: bending dominates', () => {
  it('recommends H-beam with higher Sx when UR_bending > 1.0 and UR_axial ≤ 1.0', () => {
    // Tiny Sx, huge M, zero N → UR_bending >> 1, UR_axial ≈ 0
    // Sx=5000mm³, M=50kN·m → phi_Mn=0.9*250*5000=1125000N·mm=1.125kN·m → UR_bending≈44.4
    // Huge A → UR_axial≈0; d=0, tw=0 → Av=0.6*A, V=0 → UR_shear=0
    const result = check(
      makeMR([0, 0, 0], [0, 0, 0], [50, 50, 50]),
      { Sx: 5000, A: 5000000, d: 0, tw: 0, Iy: 0 },
    )
    expect(result.status).toBe('FAIL')
    expect(result.UR_bending).toBeGreaterThan(1.0)
    expect(result.UR_axial).toBeLessThanOrEqual(1.0)
    expect(result.suggestion).toContain('H-beam')
  })
})

describe('getSuggestion — FAIL: both axial and bending exceed limit', () => {
  it('recommends a larger profile when both UR_axial > 1 and UR_bending > 1', () => {
    // Tiny A + tiny Sx, large N + large M → both fail
    // A=50, N=500kN → UR_axial≈44.4; Sx=5000, M=50kN·m → UR_bending≈44.4
    // UR_shear < max(UR_axial, UR_bending) (V=0)
    const result = check(
      makeMR([500, 500, 500], [0, 0, 0], [50, 50, 50]),
      { A: 50, Sx: 5000, d: 0, tw: 0, Iy: 0 },
    )
    expect(result.status).toBe('FAIL')
    expect(result.UR_axial).toBeGreaterThan(1.0)
    expect(result.UR_bending).toBeGreaterThan(1.0)
    expect(result.suggestion).toContain('profile ที่ใหญ่ขึ้น')
  })
})
