import { describe, it, expect } from 'vitest'
import { computeEnvelopeDiagrams } from '../envelopeAnalysis'
import type { PerComboResult } from '@/types/solver'

function makeStations(n: number) {
  return Array.from({ length: n }, (_, i) => i / (n - 1))
}

function makeMR(memberId: string, N: number[], V: number[], M: number[]) {
  return { memberId, stations: makeStations(N.length), N, V, M, endForces: [] }
}

describe('computeEnvelopeDiagrams', () => {
  it('returns per-station min/max N/V/M across combos', () => {
    const perComboResults: PerComboResult[] = [
      {
        comboId: 'c1',
        comboName: 'C1',
        memberResults: [makeMR('m1', [10, 20, 30], [5, 10, 15], [1, 2, 3])],
      },
      {
        comboId: 'c2',
        comboName: 'C2',
        memberResults: [makeMR('m1', [5, 25, 15], [8, 6, 20], [4, 0, 5])],
      },
    ]

    const [d] = computeEnvelopeDiagrams(perComboResults)
    expect(d.memberId).toBe('m1')
    expect(d.stations).toHaveLength(3)

    // minN per station
    expect(d.minN).toEqual([5, 20, 15])
    // maxN per station
    expect(d.maxN).toEqual([10, 25, 30])

    // minV per station
    expect(d.minV).toEqual([5, 6, 15])
    // maxV per station
    expect(d.maxV).toEqual([8, 10, 20])

    // minM per station
    expect(d.minM).toEqual([1, 0, 3])
    // maxM per station
    expect(d.maxM).toEqual([4, 2, 5])
  })

  it('handles single combo — min === max at each station', () => {
    const perComboResults: PerComboResult[] = [
      {
        comboId: 'c1',
        comboName: 'C1',
        memberResults: [makeMR('m1', [10, -5, 8], [3, 7, 2], [0, 4, 1])],
      },
    ]

    const [d] = computeEnvelopeDiagrams(perComboResults)
    expect(d.minN).toEqual(d.maxN)
    expect(d.minV).toEqual(d.maxV)
    expect(d.minM).toEqual(d.maxM)
  })

  it('handles multiple members', () => {
    const perComboResults: PerComboResult[] = [
      {
        comboId: 'c1',
        comboName: 'C1',
        memberResults: [
          makeMR('m1', [10, 20], [1, 2], [3, 4]),
          makeMR('m2', [50, 60], [5, 6], [7, 8]),
        ],
      },
    ]

    const diagrams = computeEnvelopeDiagrams(perComboResults)
    expect(diagrams).toHaveLength(2)
    const m2 = diagrams.find(d => d.memberId === 'm2')
    expect(m2!.maxN).toEqual([50, 60])
  })

  it('handles member that only appears in some combos', () => {
    const perComboResults: PerComboResult[] = [
      { comboId: 'c1', comboName: 'C1', memberResults: [makeMR('m1', [10, 20], [1, 2], [3, 4])] },
      { comboId: 'c2', comboName: 'C2', memberResults: [makeMR('m2', [5, 6], [0, 1], [2, 3])] },
    ]

    const diagrams = computeEnvelopeDiagrams(perComboResults)
    expect(diagrams).toHaveLength(2)
    const m1 = diagrams.find(d => d.memberId === 'm1')
    expect(m1!.maxN).toEqual([10, 20])
  })

  it('correctly tracks negative values (compression, negative shear, negative moment)', () => {
    const perComboResults: PerComboResult[] = [
      {
        comboId: 'c1',
        comboName: 'C1',
        memberResults: [makeMR('m1', [-100, -50], [-30, -10], [-20, -5])],
      },
      {
        comboId: 'c2',
        comboName: 'C2',
        memberResults: [makeMR('m1', [-80, -60], [-20, -15], [-15, -8])],
      },
    ]

    const [d] = computeEnvelopeDiagrams(perComboResults)
    expect(d.minN[0]).toBe(-100)  // most negative
    expect(d.maxN[0]).toBe(-80)   // least negative
    expect(d.minN[1]).toBe(-60)
    expect(d.maxN[1]).toBe(-50)
  })

  it('returns empty array when no combo results', () => {
    const result = computeEnvelopeDiagrams([])
    expect(result).toEqual([])
  })
})
