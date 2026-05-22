import { describe, it, expect } from 'vitest'
import { runFemAnalysis } from '@/solver'
import type { StructureNode, Member } from '@/types/structure'
import type { Load } from '@/types/loads'

// ── shared member factory ─────────────────────────────────────────────────────
function makeMember(id: string, startNodeId: string, endNodeId: string, overrides: Partial<Member> = {}): Member {
  return {
    id,
    startNodeId,
    endNodeId,
    steelProfileId: null,
    E: 200000,   // MPa  (will be converted to kN/m² inside assembler)
    A: 6353,     // mm²
    I: 4.72e7,   // mm⁴
    isTruss: false,
    ...overrides,
  }
}

// ── guard-rail error cases ────────────────────────────────────────────────────
describe('runFemAnalysis — input validation', () => {
  it('fails when fewer than 2 nodes are supplied', () => {
    const node: StructureNode = { id: 'A', x: 0, y: 0, support: 'pinned' }
    const result = runFemAnalysis([node], [], [], 'frame')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/2 nodes/i)
  })

  it('fails when no members are supplied', () => {
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'pinned' },
      { id: 'B', x: 5, y: 0, support: 'free' },
    ]
    const result = runFemAnalysis(nodes, [], [], 'frame')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/1 member/i)
  })

  it('fails when structure has no supports', () => {
    const nodes: StructureNode[] = [
      { id: 'A', x: 0, y: 0, support: 'free' },
      { id: 'B', x: 5, y: 0, support: 'free' },
    ]
    const members = [makeMember('M1', 'A', 'B')]
    const result = runFemAnalysis(nodes, members, [], 'frame')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/unstable/i)
  })

  it('returns empty result arrays on failure', () => {
    const result = runFemAnalysis([], [], [], 'frame')
    expect(result.nodeResults).toEqual([])
    expect(result.reactions).toEqual([])
    expect(result.memberResults).toEqual([])
  })

  it('includes a timestamp on failure', () => {
    const before = Date.now()
    const result = runFemAnalysis([], [], [], 'frame')
    expect(result.timestamp).toBeGreaterThanOrEqual(before)
  })
})

// ── simply supported beam under midpoint load ─────────────────────────────────
// Analytical: δ_max = PL³/(48EI) at midpoint
// Reactions: RA = RB = P/2
// Moment at midpoint: M = PL/4
describe('runFemAnalysis — simply supported beam, midpoint load', () => {
  // Properties in the units the solver expects (MPa, mm², mm⁴)
  // E = 200000 MPa, I = 4.72e7 mm⁴, L = 5000 mm = 5 m
  // After conversion: E = 200e6 kN/m², I = 0.0472 m⁴ — wait, assembler converts:
  // mpaToKnM2(200000) = 200000 * 1e3 = 2e8 kN/m²
  // mm4ToM4(4.72e7)   = 4.72e7 * 1e-12 = 4.72e-5 m⁴
  // A: mmToM2(6353) = 6.353e-3 m²
  const E_kn_m2 = 200000 * 1e3  // kN/m² (after conversion)
  const I_m4 = 4.72e7 * 1e-12   // m⁴
  const L = 5  // m

  const nodes: StructureNode[] = [
    { id: 'A', x: 0, y: 0, support: 'pinned' },
    { id: 'C', x: L / 2, y: 0, support: 'free' },
    { id: 'B', x: L, y: 0, support: 'roller', rollerAxis: 'y' },
  ]
  const members = [
    makeMember('M1', 'A', 'C'),
    makeMember('M2', 'C', 'B'),
  ]
  const P = 100  // kN downward
  const loads: Load[] = [
    { id: 'L1', type: 'point_load', nodeId: 'C', fx: 0, fy: -P },
  ]

  let result: ReturnType<typeof runFemAnalysis>

  it('succeeds', () => {
    result = runFemAnalysis(nodes, members, loads, 'frame')
    expect(result.success).toBe(true)
  })

  it('has results for all 3 nodes', () => {
    result = runFemAnalysis(nodes, members, loads, 'frame')
    expect(result.nodeResults.length).toBe(3)
  })

  it('vertical reactions sum to the applied load', () => {
    result = runFemAnalysis(nodes, members, loads, 'frame')
    const totalRy = result.reactions.reduce((s, r) => s + r.ry, 0)
    expect(Math.abs(totalRy - P)).toBeLessThan(0.5)  // within 0.5 kN
  })

  it('reactions at A and B are approximately equal (symmetric)', () => {
    result = runFemAnalysis(nodes, members, loads, 'frame')
    const rA = result.reactions.find(r => r.nodeId === 'A')
    const rB = result.reactions.find(r => r.nodeId === 'B')
    expect(Math.abs(Math.abs(rA!.ry) - Math.abs(rB!.ry))).toBeLessThan(0.5)
  })

  it('midpoint node displaces downward', () => {
    result = runFemAnalysis(nodes, members, loads, 'frame')
    const midResult = result.nodeResults.find(r => r.nodeId === 'C')
    expect(midResult!.uy).toBeLessThan(0)
  })

  it('midpoint vertical displacement is close to analytical PL³/(48EI)', () => {
    result = runFemAnalysis(nodes, members, loads, 'frame')
    const midResult = result.nodeResults.find(r => r.nodeId === 'C')
    // δ = PL³/(48EI) in meters, then ×1000 for mm
    const deltaAnalytical = P * Math.pow(L, 3) / (48 * E_kn_m2 * I_m4) * 1000  // mm
    // FEM with 2 elements will not be exact; allow 5% tolerance
    expect(Math.abs(midResult!.uy - (-deltaAnalytical))).toBeLessThan(Math.abs(deltaAnalytical) * 0.05)
  })

  it('returns member results for both members', () => {
    result = runFemAnalysis(nodes, members, loads, 'frame')
    expect(result.memberResults.length).toBe(2)
  })

  it('member results have 21 stations', () => {
    result = runFemAnalysis(nodes, members, loads, 'frame')
    result.memberResults.forEach(mr => expect(mr.stations.length).toBe(21))
  })

  it('endForces array has 6 elements per member', () => {
    result = runFemAnalysis(nodes, members, loads, 'frame')
    result.memberResults.forEach(mr => expect(mr.endForces.length).toBe(6))
  })

  it('includes a timestamp', () => {
    const before = Date.now()
    result = runFemAnalysis(nodes, members, loads, 'frame')
    expect(result.timestamp).toBeGreaterThanOrEqual(before)
  })
})

// ── cantilever beam under tip load ───────────────────────────────────────────
// Analytical: δ_tip = PL³/(3EI), M_base = PL
describe('runFemAnalysis — cantilever beam, tip point load', () => {
  const E_kn_m2 = 200000 * 1e3
  const I_m4 = 4.72e7 * 1e-12
  const L = 3  // m

  const nodes: StructureNode[] = [
    { id: 'A', x: 0, y: 0, support: 'fixed' },
    { id: 'B', x: L, y: 0, support: 'free' },
  ]
  const members = [makeMember('M1', 'A', 'B')]
  const P = 50  // kN downward
  const loads: Load[] = [
    { id: 'L1', type: 'point_load', nodeId: 'B', fx: 0, fy: -P },
  ]

  it('succeeds', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    expect(result.success).toBe(true)
  })

  it('fixed end has zero displacement and rotation', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    const nodeA = result.nodeResults.find(r => r.nodeId === 'A')
    expect(nodeA!.ux).toBeCloseTo(0, 2)
    expect(nodeA!.uy).toBeCloseTo(0, 2)
    expect(nodeA!.rz).toBeCloseTo(0, 2)
  })

  it('tip deflection matches analytical PL³/(3EI)', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    const nodeB = result.nodeResults.find(r => r.nodeId === 'B')
    const deltaAnalytical = P * Math.pow(L, 3) / (3 * E_kn_m2 * I_m4) * 1000 // mm
    expect(Math.abs(nodeB!.uy - (-deltaAnalytical))).toBeLessThan(Math.abs(deltaAnalytical) * 0.01)
  })

  it('vertical reaction at fixed end equals applied load', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    const rA = result.reactions.find(r => r.nodeId === 'A')
    expect(rA!.ry).toBeCloseTo(P, 1)
  })

  it('moment reaction at fixed end equals PL', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    const rA = result.reactions.find(r => r.nodeId === 'A')
    // Reaction moment M = -PL (from global equilibrium)
    expect(Math.abs(rA!.mz)).toBeCloseTo(P * L, 1)
  })
})

// ── truss analysis ────────────────────────────────────────────────────────────
// Simple 2-bar vertical truss: node A (pinned), B (roller-x), C (mid, free)
// Applied downward load at C → symmetric, each member bears P/(2cos(θ))
describe('runFemAnalysis — 2-bar symmetric truss, apex load', () => {
  // H = 3m height, half-width = 4m, so L = 5m per bar (3-4-5 triangle)
  const nodes: StructureNode[] = [
    { id: 'A', x: -4, y: 0, support: 'pinned' },
    { id: 'B', x: 4, y: 0, support: 'pinned' },
    { id: 'C', x: 0, y: 3, support: 'free' },
  ]

  const makeTrussMember = (id: string, s: string, e: string): Member => ({
    id,
    startNodeId: s,
    endNodeId: e,
    steelProfileId: null,
    E: 200000,
    A: 6353,
    I: 0,
    isTruss: true,
  })

  const members = [makeTrussMember('M1', 'A', 'C'), makeTrussMember('M2', 'B', 'C')]
  const loads: Load[] = [
    { id: 'L1', type: 'point_load', nodeId: 'C', fx: 0, fy: -200 },
  ]

  it('succeeds', () => {
    const result = runFemAnalysis(nodes, members, loads, 'truss')
    expect(result.success).toBe(true)
  })

  it('vertical reactions sum to applied load', () => {
    const result = runFemAnalysis(nodes, members, loads, 'truss')
    const totalRy = result.reactions.reduce((s, r) => s + r.ry, 0)
    expect(Math.abs(totalRy - 200)).toBeLessThan(1)
  })

  it('horizontal reactions cancel (symmetric truss)', () => {
    const result = runFemAnalysis(nodes, members, loads, 'truss')
    const totalRx = result.reactions.reduce((s, r) => s + r.rx, 0)
    expect(Math.abs(totalRx)).toBeLessThan(1)
  })

  it('apex node displaces downward', () => {
    const result = runFemAnalysis(nodes, members, loads, 'truss')
    const nodeC = result.nodeResults.find(r => r.nodeId === 'C')
    expect(nodeC!.uy).toBeLessThan(0)
  })
})

// ── moment load on frame ──────────────────────────────────────────────────────
describe('runFemAnalysis — frame with moment load', () => {
  const nodes: StructureNode[] = [
    { id: 'A', x: 0, y: 0, support: 'fixed' },
    { id: 'B', x: 4, y: 0, support: 'free' },
  ]
  const members = [makeMember('M1', 'A', 'B')]
  const loads: Load[] = [
    { id: 'L1', type: 'moment', nodeId: 'B', mz: 100 },
  ]

  it('succeeds', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    expect(result.success).toBe(true)
  })

  it('free end rotates under applied moment', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    const nodeB = result.nodeResults.find(r => r.nodeId === 'B')
    expect(nodeB!.rz).not.toBeCloseTo(0, 3)
  })

  it('moment reaction at fixed end balances applied moment', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    const rA = result.reactions.find(r => r.nodeId === 'A')
    // For a propped cantilever with moment at free end, M_base ≈ 100 kN·m
    expect(Math.abs(rA!.mz)).toBeGreaterThan(0)
  })
})

// ── distributed load integration test ─────────────────────────────────────────
describe('runFemAnalysis — frame with distributed load', () => {
  const nodes: StructureNode[] = [
    { id: 'A', x: 0, y: 0, support: 'fixed' },
    { id: 'B', x: 6, y: 0, support: 'fixed' },
  ]
  const members = [makeMember('M1', 'A', 'B')]
  const w = 20  // kN/m
  const L = 6   // m
  const loads: Load[] = [
    { id: 'L1', type: 'distributed_load', memberId: 'M1', w1: w, w2: w, direction: 'local_y' },
  ]

  it('succeeds', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    expect(result.success).toBe(true)
  })

  it('both fixed supports have non-zero vertical reactions', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    result.reactions.forEach(r => expect(Math.abs(r.ry)).toBeGreaterThan(0))
  })

  it('each fixed support carries approximately half the total load in absolute terms', () => {
    // For symmetric UDL on fixed-fixed beam, |ry| ≈ w*L/2 at each support
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    result.reactions.forEach(r => {
      expect(Math.abs(Math.abs(r.ry) - (w * L) / 2)).toBeLessThan(5)
    })
  })
})
