import { describe, it, expect } from 'vitest'
import { computeEnvelope, envelopeToMemberResult } from '../envelopeAnalysis'
import type { PerComboResult } from '@/types/solver'

function makeMR(memberId: string, N: number[], V: number[], M: number[]) {
  return { memberId, stations: N.map((_, i) => i / (N.length - 1)), N, V, M, endForces: [] }
}

describe('computeEnvelope', () => {
  it('extracts max tension/compression N, maxAbsV, maxAbsM per member', () => {
    const perComboResults: PerComboResult[] = [
      {
        comboId: 'c1',
        comboName: 'Combo 1',
        memberResults: [makeMR('m1', [30, 50], [10, 20], [5, 15])],
      },
      {
        comboId: 'c2',
        comboName: 'Combo 2',
        memberResults: [makeMR('m1', [-45, -20], [25, 5], [30, 10])],
      },
    ]

    const [e] = computeEnvelope(perComboResults)
    expect(e.memberId).toBe('m1')
    expect(e.maxTensionN).toBe(50)
    expect(e.maxTensionN_combo).toBe('c1')
    expect(e.maxCompressionN).toBe(45)
    expect(e.maxCompressionN_combo).toBe('c2')
    expect(e.maxAbsV).toBe(25)
    expect(e.maxAbsV_combo).toBe('c2')
    expect(e.maxAbsM).toBe(30)
    expect(e.maxAbsM_combo).toBe('c2')
  })

  it('handles member that only appears in one combo', () => {
    const perComboResults: PerComboResult[] = [
      { comboId: 'c1', comboName: 'C1', memberResults: [makeMR('m1', [10], [5], [3])] },
      { comboId: 'c2', comboName: 'C2', memberResults: [makeMR('m2', [20], [8], [6])] },
    ]

    const envelopes = computeEnvelope(perComboResults)
    const m1 = envelopes.find(e => e.memberId === 'm1')
    const m2 = envelopes.find(e => e.memberId === 'm2')
    expect(m1).toBeDefined()
    expect(m2).toBeDefined()
    expect(m1!.maxTensionN).toBe(10)
    expect(m2!.maxTensionN).toBe(20)
  })

  it('member with only compression has maxTensionN = 0', () => {
    const perComboResults: PerComboResult[] = [
      { comboId: 'c1', comboName: 'C1', memberResults: [makeMR('m1', [-100, -50], [5], [10])] },
    ]
    const [e] = computeEnvelope(perComboResults)
    expect(e.maxTensionN).toBe(0)
    expect(e.maxTensionN_combo).toBe('')
    expect(e.maxCompressionN).toBe(100)
    expect(e.maxCompressionN_combo).toBe('c1')
  })

  it('single combo → envelope equals that combo', () => {
    const perComboResults: PerComboResult[] = [
      { comboId: 'c1', comboName: 'C1', memberResults: [makeMR('m1', [10, -5, 8], [3, 7], [2, 9])] },
    ]
    const [e] = computeEnvelope(perComboResults)
    expect(e.maxTensionN).toBe(10)
    expect(e.maxCompressionN).toBe(5)
    expect(e.maxAbsV).toBe(7)
    expect(e.maxAbsM).toBe(9)
  })

  it('correctly tracks compression from member that has both tension and compression N across stations', () => {
    const perComboResults: PerComboResult[] = [
      {
        comboId: 'c1',
        comboName: 'C1',
        memberResults: [makeMR('m1', [20, -30, 10, -50, 5], [1], [1])],
      },
    ]
    const [e] = computeEnvelope(perComboResults)
    expect(e.maxTensionN).toBe(20)
    expect(e.maxCompressionN).toBe(50)
  })
})

describe('envelopeToMemberResult', () => {
  it('uses compression when |compression| > |tension|', () => {
    const envelope = {
      memberId: 'm1',
      maxTensionN: 30,
      maxTensionN_combo: 'c1',
      maxCompressionN: 60,
      maxCompressionN_combo: 'c2',
      maxAbsV: 15,
      maxAbsV_combo: 'c1',
      maxAbsM: 25,
      maxAbsM_combo: 'c1',
    }
    const mr = envelopeToMemberResult(envelope)
    expect(mr.memberId).toBe('m1')
    expect(mr.N[0]).toBe(-60)
    expect(mr.V[0]).toBe(15)
    expect(mr.M[0]).toBe(25)
  })

  it('uses tension when |tension| >= |compression|', () => {
    const envelope = {
      memberId: 'm2',
      maxTensionN: 80,
      maxTensionN_combo: 'c1',
      maxCompressionN: 40,
      maxCompressionN_combo: 'c2',
      maxAbsV: 5,
      maxAbsV_combo: 'c1',
      maxAbsM: 10,
      maxAbsM_combo: 'c1',
    }
    const mr = envelopeToMemberResult(envelope)
    expect(mr.N[0]).toBe(80)
  })

  it('returns two stations with same values', () => {
    const envelope = {
      memberId: 'm3',
      maxTensionN: 10,
      maxTensionN_combo: 'c1',
      maxCompressionN: 0,
      maxCompressionN_combo: '',
      maxAbsV: 5,
      maxAbsV_combo: 'c1',
      maxAbsM: 8,
      maxAbsM_combo: 'c1',
    }
    const mr = envelopeToMemberResult(envelope)
    expect(mr.stations).toHaveLength(2)
    expect(mr.N).toHaveLength(2)
    expect(mr.N[0]).toBe(mr.N[1])
  })
})
