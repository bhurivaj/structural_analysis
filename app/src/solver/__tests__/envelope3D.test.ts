import { describe, it, expect } from 'vitest'
import { computeEnvelope, computeEnvelopeDiagrams, envelopeToMemberResult } from '../envelopeAnalysis'
import type { MemberResult, PerComboResult } from '@/types/solver'
import { mockMemberResult } from '@/test-utils/mocks'

const combo = (comboId: string, ...memberResults: MemberResult[]): PerComboResult =>
  ({ comboId, comboName: comboId, memberResults })

describe('envelope — 3D forces (Vz, My, T)', () => {
  // c1 governs strong axis, c2 governs weak axis + torsion (lateral load)
  const perCombo = [
    combo('c1', mockMemberResult({ memberId: 'm1', N: [0, 0], V: [10, 10], M: [20, -30], Vz: [1, 1], My: [2, 2], T: [0, 0] })),
    combo('c2', mockMemberResult({ memberId: 'm1', N: [0, 0], V: [1, 1], M: [2, 2], Vz: [-8, 8], My: [-40, 15], T: [0.5, -3] })),
  ]

  it('tracks max |Vz|, |My|, |T| and governing combo independently of V/M', () => {
    const [e] = computeEnvelope(perCombo)
    expect(e.maxAbsM).toBe(30)
    expect(e.maxAbsM_combo).toBe('c1')
    expect(e.maxAbsVz).toBe(8)
    expect(e.maxAbsVz_combo).toBe('c2')
    expect(e.maxAbsMy).toBe(40)
    expect(e.maxAbsMy_combo).toBe('c2')
    expect(e.maxAbsT).toBe(3)
    expect(e.maxAbsT_combo).toBe('c2')
  })

  it('envelopeToMemberResult carries weak-axis and torsion demand through', () => {
    const mr = envelopeToMemberResult(computeEnvelope(perCombo)[0])
    expect(mr.My).toEqual([40, 40])
    expect(mr.Vz).toEqual([8, 8])
    expect(mr.T).toEqual([3, 3])
    expect(mr.Mz).toEqual(mr.M)
    expect(mr.Vy).toEqual(mr.V)
  })

  it('pure 2D results give zero 3D envelope values', () => {
    const [e] = computeEnvelope([combo('c1', mockMemberResult({ memberId: 'm1', N: [5], V: [1], M: [2] }))])
    expect(e.maxAbsVz).toBe(0)
    expect(e.maxAbsMy).toBe(0)
    expect(e.maxAbsT).toBe(0)
  })

  it('tolerates legacy results missing 3D arrays (old cached sessions)', () => {
    const legacy = { memberId: 'm1', stations: [0, 1], N: [1, 1], V: [2, 2], M: [3, 3], endForces: [] } as unknown as MemberResult
    const [e] = computeEnvelope([combo('c1', legacy)])
    expect(e.maxAbsMy).toBe(0)
    const [d] = computeEnvelopeDiagrams([combo('c1', legacy)])
    expect(d.minMy).toEqual([0, 0])
  })

  it('computeEnvelopeDiagrams gives per-station min/max for Vz, My, T', () => {
    const [d] = computeEnvelopeDiagrams(perCombo)
    expect(d.minMy).toEqual([-40, 2])
    expect(d.maxMy).toEqual([2, 15])
    expect(d.minVz).toEqual([-8, 1])
    expect(d.maxVz).toEqual([1, 8])
    expect(d.minT).toEqual([0, -3])
    expect(d.maxT).toEqual([0.5, 0])
  })
})
