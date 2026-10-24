import { describe, it, expect } from 'vitest'
import { computeURForSection, section3DProps, type URSectionProps } from '@/utils/urSection'
import { performDesignCheck } from '@/utils/designCheck'
import { findOptimalProfile } from '@/utils/autoSize'
import type { Member, StructureNode } from '@/types/structure'
import type { MemberResult } from '@/types/solver'
import type { SteelProfile } from '@/types/steel'
import { mockMemberResult } from '@/test-utils/mocks'

// TIS H 100×100 as stored in src/data (tf/tw as in source data)
const H100: SteelProfile = {
  id: 'H100', standard: 'TIS', profileClass: 'H', designation: 'H 100×100×8×6',
  d: 100, bf: 100, tf: 6, tw: 8, r: 10, A: 2190, Ix: 3830000, Iy: 1340000,
  Sx: 77000, Zx: 77000, rx: 0, ry: 0, mass: 17.2, E: 200000, Fy: 250,
}
const base: URSectionProps = { A: 2190, Fy: 250, Sx: 77000, ry: 0, d: 100, tw: 8, E: 200000 }
const zero = { maxAbsN: 0, maxAbsV: 0, maxAbsM: 0, isCompression: false }

describe('section3DProps', () => {
  it('H: Sy = Iy/(bf/2), Avz = 2·bf·tf, Ct = J/t_max', () => {
    const p = section3DProps(H100)
    expect(p.Sy).toBeCloseTo(26800, 0)
    expect(p.Avz).toBe(1200)
    const J = (2 * 100 * 6 ** 3 + 88 * 8 ** 3) / 3
    expect(p.Ct).toBeCloseTo(J / 8, 3)
  })

  it('C / L use full width for Sy (conservative, asymmetric)', () => {
    expect(section3DProps({ ...H100, profileClass: 'C' }).Sy).toBeCloseTo(13400, 0)
    expect(section3DProps({ ...H100, profileClass: 'L' }).Avz).toBe(600) // one leg
  })

  it('CHS / RoundPipe: Sy = Sx; closed-section torsion C = π(D−t)²t/2', () => {
    const rp: SteelProfile = { ...H100, profileClass: 'RoundPipe', d: 21.7, bf: 0, tf: 2, tw: 2, Sx: 562 }
    const p = section3DProps(rp)
    expect(p.Sy).toBe(562)
    expect(p.Ct).toBeCloseTo((Math.PI * (21.7 - 2) ** 2 * 2) / 2, 3)
  })

  it('RHS torsion uses AISC H3.1 C = 2(B−t)(H−t)t − 4.5(4−π)t³', () => {
    const rhs: SteelProfile = { ...H100, profileClass: 'RHS', d: 50, bf: 25, tf: 2, tw: 2, Iy: 27599 }
    expect(section3DProps(rhs).Ct).toBeCloseTo(2 * 23 * 48 * 2 - 4.5 * (4 - Math.PI) * 8, 3)
  })
})

describe('computeURForSection — biaxial / torsion', () => {
  const s3 = { ...base, ...section3DProps(H100) }

  it('pure weak-axis moment: UR_bending = My/(0.9·Fy·Sy)', () => {
    const r = computeURForSection({ ...zero, maxAbsMy: 1 }, s3, 0, false)
    expect(r.UR_bending).toBeCloseTo(1e6 / (0.9 * 250 * 26800), 3)
  })

  it('H1-1b (Pr/Pc < 0.2): axial/2 + Mx/φMnx + My/φMny', () => {
    const r = computeURForSection({ ...zero, maxAbsN: 10, maxAbsM: 2, maxAbsMy: 1 }, s3, 0, false)
    const ax = 10000 / (0.9 * 250 * 2190)
    const bend = 2e6 / (0.9 * 250 * 77000) + 1e6 / (0.9 * 250 * 26800)
    expect(r.UR_combined).toBeCloseTo(ax / 2 + bend, 3)
  })

  it('H1-1a (Pr/Pc ≥ 0.2): axial + 8/9·(Mx/φMnx + My/φMny)', () => {
    const r = computeURForSection({ ...zero, maxAbsN: 200, maxAbsM: 2, maxAbsMy: 1 }, s3, 0, false)
    const ax = 200000 / (0.9 * 250 * 2190)
    const bend = 2e6 / (0.9 * 250 * 77000) + 1e6 / (0.9 * 250 * 26800)
    expect(r.UR_combined).toBeCloseTo(ax + (8 / 9) * bend, 3)
  })

  it('shear: max(Vy, Vz) ratio plus torsion ratio', () => {
    const r = computeURForSection({ ...zero, maxAbsV: 1, maxAbsVz: 10, maxAbsT: 0.1 }, s3, 0, false)
    const vz = 10000 / (0.6 * 250 * 1200)
    const t = 0.1e6 / s3.Ct! / (0.9 * 0.6 * 250)
    expect(r.UR_shear).toBeCloseTo(vz + t, 3)
  })

  it('2D inputs (no 3D fields) give the same result as before', () => {
    const f = { maxAbsN: 50, maxAbsV: 5, maxAbsM: 4, isCompression: false }
    expect(computeURForSection(f, s3, 3000, false)).toEqual(computeURForSection(f, base, 3000, false))
  })

  it('tension-only ignores bending/torsion', () => {
    const r = computeURForSection({ ...zero, maxAbsN: 50, maxAbsMy: 5, maxAbsT: 1 }, s3, 0, true)
    expect(r.UR_combined).toBe(r.UR_axial)
  })
})

describe('performDesignCheck — 3D', () => {
  const profiles = new Map([['H100', H100]])
  const mk = (id: string, end: string): Member =>
    ({ id, startNodeId: 'n0', endNodeId: end, steelProfileId: 'H100', E: 200000, A: 2190, I: 3830000, isTruss: false })
  const nodes = new Map<string, StructureNode>([
    ['n0', { id: 'n0', x: 0, y: 0, z: 0, support: 'pinned' }],
    ['nx', { id: 'nx', x: 5, y: 0, z: 0, support: 'free' }],
    ['nz', { id: 'nz', x: 0, y: 0, z: 5, support: 'free' }],
  ])
  const comp = (memberId: string) => mockMemberResult({ memberId, N: [-100, -100], V: [0, 0], M: [0, 0] })

  it('member along Z gets its real length (buckling applies like an X member)', () => {
    const members = new Map([['mx', mk('mx', 'nx')], ['mz', mk('mz', 'nz')]])
    const [rx, rz] = performDesignCheck([comp('mx'), comp('mz')], members, nodes, profiles, 250)
    expect(rz.UR_axial).toBeCloseTo(rx.UR_axial, 6)
    expect(rz.UR_axial).toBeGreaterThan(100000 / (0.9 * 250 * 2190)) // > squash-load UR
  })

  it('weak-axis moment raises UR; legacy result without My matches 2D', () => {
    const members = new Map([['mx', mk('mx', 'nx')]])
    const flat = mockMemberResult({ memberId: 'mx', N: [0, 0], V: [1, 1], M: [2, 2] })
    const withMy = { ...flat, My: [3, -3] }
    const legacy = { ...flat, My: undefined, Vz: undefined, T: undefined } as unknown as MemberResult
    const [a] = performDesignCheck([flat], members, nodes, profiles, 250)
    const [b] = performDesignCheck([withMy], members, nodes, profiles, 250)
    const [c] = performDesignCheck([legacy], members, nodes, profiles, 250)
    expect(b.UR_bending).toBeGreaterThan(a.UR_bending)
    expect(c).toEqual(a)
  })
})

describe('findOptimalProfile — weak-axis demand', () => {
  it('picks a heavier section when My is present', () => {
    const small: SteelProfile = { ...H100, id: 'S', mass: 10, Iy: 200000 }
    const big: SteelProfile = { ...H100, id: 'B', mass: 30, Iy: 3000000 }
    const member: Member = { id: 'm', startNodeId: 'n0', endNodeId: 'n1', steelProfileId: null, E: 200000, A: 2190, I: 3830000, isTruss: false }
    const nodes = new Map<string, StructureNode>([
      ['n0', { id: 'n0', x: 0, y: 0, support: 'pinned' }],
      ['n1', { id: 'n1', x: 1, y: 0, support: 'free' }],
    ])
    const mr = mockMemberResult({ memberId: 'm', N: [0, 0], V: [0, 0], M: [1, 1] })
    expect(findOptimalProfile(mr, member, nodes, [small, big], 250, 0.8, 1)?.id).toBe('S')
    expect(findOptimalProfile({ ...mr, My: [3, 3] }, member, nodes, [small, big], 250, 0.8, 1)?.id).toBe('B')
  })
})
