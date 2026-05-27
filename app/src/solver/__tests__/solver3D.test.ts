import { describe, it, expect } from 'vitest'
import { runFemAnalysis } from '@/solver'
import type { StructureNode, Member } from '@/types/structure'
import type { Load } from '@/types/loads'

// ── helpers ──────────────────────────────────────────────────────────────────
function node(id: string, x: number, y: number, z = 0, support: StructureNode['support'] = 'free'): StructureNode {
  return { id, x, y, z, support }
}

function member(id: string, s: string, e: string, E = 200000, A = 10000, I = 1e8): Member {
  return { id, startNodeId: s, endNodeId: e, steelProfileId: null, E, A, I, isTruss: false }
}

function trMember(id: string, s: string, e: string, E = 200000, A = 10000): Member {
  return { id, startNodeId: s, endNodeId: e, steelProfileId: null, E, A, I: 0, isTruss: true }
}

function pointLoad(nodeId: string, fx = 0, fy = 0, fz = 0): Load {
  return { id: 'ld', type: 'point_load', nodeId, fx, fy, fz }
}

// ── 2D backward compat ────────────────────────────────────────────────────────
describe('Backward compat — 2D frame (all z=0)', () => {
  // Cantilever: A fixed, B free, 5 m, Fy=-10 kN at B
  // Expected tip deflection: FL³/(3EI)
  const E = 200000, A = 10000, I = 1e8  // MPa, mm², mm⁴
  // In SI: E_kN = 2e8 kN/m², A_m = 0.01 m², I_m = 1e-4 m⁴
  // L = 5 m, F = -10 kN
  // uy = -FL³/(3EI) = 10*125/(3*2e8*1e-4) = 1250/60000 ≈ 0.020833 m = 20.83 mm
  const L = 5

  const nodes = [
    node('A', 0, 0, 0, 'fixed'),
    node('B', L, 0, 0, 'free'),
  ]
  const members = [member('M1', 'A', 'B', E, A, I)]
  const loads: Load[] = [pointLoad('B', 0, -10)]

  it('produces uz=0 for all nodes (no out-of-plane loads)', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    expect(result.success).toBe(true)
    for (const nr of result.nodeResults) {
      expect(Math.abs(nr.uz)).toBeLessThan(1e-6)
    }
  })

  it('produces rx=ry=0 for all nodes (no out-of-plane)', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    for (const nr of result.nodeResults) {
      expect(Math.abs(nr.rx)).toBeLessThan(1e-10)
      expect(Math.abs(nr.ry)).toBeLessThan(1e-10)
    }
  })

  it('tip uy deflection matches FL³/(3EI) analytical solution', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    const tipNode = result.nodeResults.find(r => r.nodeId === 'B')!
    const E_kN = E * 1e3          // kN/m²
    const A_m  = A * 1e-6         // m²
    const I_m  = I * 1e-12        // m⁴
    const F = -10                  // kN
    const expected = F * L ** 3 / (3 * E_kN * I_m) * 1000  // mm
    expect(tipNode.uy).toBeCloseTo(expected, 2)
  })

  it('V = Vy and M = Mz (backward compat aliases)', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    const mr = result.memberResults[0]
    expect(mr.V).toBe(mr.Vy)
    expect(mr.M).toBe(mr.Mz)
  })

  it('Vz and My are zero (no out-of-plane loads)', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    const mr = result.memberResults[0]
    for (const v of mr.Vz) expect(Math.abs(v)).toBeLessThan(1e-6)
    for (const v of mr.My) expect(Math.abs(v)).toBeLessThan(1e-6)
  })
})

// ── 3D truss ────────────────────────────────────────────────────────────────
describe('3D truss — inclined member spanning Z', () => {
  // Member: A pinned at (0,0,0), B free at (0,0,3) (vertical Z member)
  // Fz = -5 kN at B (axial compression along member)
  // Expected: uz_B = -FL/(EA) (axial shortening)
  const E = 200000, A = 1000  // MPa, mm²
  // E_kN = 2e8, A_m = 1e-3 m²
  // L = 3 m, Fz = -5 kN
  // uz = -5*3 / (2e8 * 1e-3) = -15 / 2e5 = -7.5e-5 m = -0.075 mm
  const L = 3

  const nodes = [
    node('A', 0, 0, 0, 'pinned'),
    node('B', 0, 0, L, 'free'),
  ]
  const members = [trMember('M1', 'A', 'B', E, A)]
  const loads: Load[] = [pointLoad('B', 0, 0, -5)]

  it('succeeds', () => {
    const result = runFemAnalysis(nodes, members, loads, 'truss')
    expect(result.success).toBe(true)
  })

  it('uz at free end matches axial shortening FL/(EA)', () => {
    const result = runFemAnalysis(nodes, members, loads, 'truss')
    const B = result.nodeResults.find(r => r.nodeId === 'B')!
    const expected = -5 * L / (E * 1e3 * A * 1e-6) * 1000  // mm
    expect(B.uz).toBeCloseTo(expected, 3)
  })

  it('N = -5 kN (axial compression)', () => {
    const result = runFemAnalysis(nodes, members, loads, 'truss')
    const mr = result.memberResults[0]
    expect(mr.N[0]).toBeCloseTo(-5, 2)
  })
})

// ── 3D truss — space truss ────────────────────────────────────────────────────
describe('3D truss — 3-bar space truss under Fz', () => {
  // A(1,0,0), B(0,1,0), C(0,0,0) all pinned; D(0,0,1) free.
  // Members AD, BD, CD — directions span ℝ³ → non-singular stiffness at D.
  // Under Fz=-10 at D, symmetry gives ux=uy=uz at D.
  const E = 200000, A = 1000
  const nodes = [
    node('A',  1, 0, 0, 'pinned'),
    node('B',  0, 1, 0, 'pinned'),
    node('C',  0, 0, 0, 'pinned'),
    node('D',  0, 0, 1, 'free'),
  ]
  const members = [
    trMember('M1', 'A', 'D', E, A),
    trMember('M2', 'B', 'D', E, A),
    trMember('M3', 'C', 'D', E, A),
  ]
  const loads: Load[] = [pointLoad('D', 0, 0, -10)]

  it('succeeds', () => {
    const result = runFemAnalysis(nodes, members, loads, 'truss')
    expect(result.success).toBe(true)
  })

  it('produces non-zero uz at apex under Fz', () => {
    const result = runFemAnalysis(nodes, members, loads, 'truss')
    const D = result.nodeResults.find(r => r.nodeId === 'D')!
    expect(Math.abs(D.uz)).toBeGreaterThan(1e-4)
  })

  it('ux and uy are equal to uz (symmetry)', () => {
    const result = runFemAnalysis(nodes, members, loads, 'truss')
    const D = result.nodeResults.find(r => r.nodeId === 'D')!
    expect(D.ux).toBeCloseTo(D.uz, 3)
    expect(D.uy).toBeCloseTo(D.uz, 3)
  })
})

// ── 3D frame with Fz load ─────────────────────────────────────────────────────
describe('3D frame — Fz load on cantilever', () => {
  // Beam along X, fixed at A, free at B
  // Fz = -10 kN at B → out-of-plane bending
  // Expected: uz at B = -FzL³/(3EIy) where Iy = strong axis (I = I_m⁴)
  const E = 200000, A = 10000, I = 1e8  // MPa, mm², mm⁴
  const L = 5

  const nodes = [
    node('A', 0, 0, 0, 'fixed'),
    node('B', L, 0, 0, 'free'),
  ]
  const members = [member('M1', 'A', 'B', E, A, I)]
  const loads: Load[] = [pointLoad('B', 0, 0, -10)]

  it('succeeds', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    expect(result.success).toBe(true)
  })

  it('produces significant uz at free end', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    const B = result.nodeResults.find(r => r.nodeId === 'B')!
    expect(Math.abs(B.uz)).toBeGreaterThan(0.001)  // > 0.001 mm
  })

  it('uy is negligible (only Fz applied)', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    const B = result.nodeResults.find(r => r.nodeId === 'B')!
    expect(Math.abs(B.uy)).toBeLessThan(1e-6)
  })

  it('Vz and My are non-zero in member results', () => {
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    const mr = result.memberResults[0]
    const hasVz = mr.Vz.some(v => Math.abs(v) > 0.001)
    const hasMy = mr.My.some(v => Math.abs(v) > 0.001)
    expect(hasVz).toBe(true)
    expect(hasMy).toBe(true)
  })
})

// ── Reactions balanced ────────────────────────────────────────────────────────
describe('Reaction equilibrium — 3D frame', () => {
  const nodes = [
    node('A', 0, 0, 0, 'fixed'),
    node('B', 5, 0, 0, 'free'),
  ]
  const members = [member('M1', 'A', 'B')]
  const fx = 3, fy = -7, fz = 5

  it('reactions sum to applied loads (equilibrium)', () => {
    const loads: Load[] = [pointLoad('B', fx, fy, fz)]
    const result = runFemAnalysis(nodes, members, loads, 'frame')
    expect(result.success).toBe(true)
    const rxn = result.reactions[0]  // node A is the only supported node
    expect(rxn.rx).toBeCloseTo(-fx, 2)
    expect(rxn.ry).toBeCloseTo(-fy, 2)
    expect(rxn.rz).toBeCloseTo(-fz, 2)
  })
})
