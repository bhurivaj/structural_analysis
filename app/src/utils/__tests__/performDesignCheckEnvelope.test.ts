import { describe, it, expect } from 'vitest'
import { performDesignCheckEnvelope } from '@/utils/designCheck'
import type { Member, StructureNode } from '@/types/structure'
import type { PerComboResult } from '@/types/solver'

function makeMR(memberId: string, N: number[], V: number[], M: number[]) {
  return { memberId, stations: [0, 1], N, V, M, endForces: [] }
}

const node1: StructureNode = { id: 'n1', x: 0, y: 0, support: 'pinned', label: 'N1' }
const node2: StructureNode = { id: 'n2', x: 0, y: 5, support: 'free', label: 'N2' }

const member: Member = {
  id: 'm1',
  startNodeId: 'n1',
  endNodeId: 'n2',
  E: 200000,
  A: 2000,
  I: 1e6,
  isTruss: false,
  label: 'M1',
}

const nodes = new Map([['n1', node1], ['n2', node2]])
const members = new Map([['m1', member]])
const profiles = new Map()

describe('performDesignCheckEnvelope', () => {
  it('returns the worst UR_combined across all combos per member', () => {
    const perComboResults: PerComboResult[] = [
      {
        comboId: 'c1',
        comboName: 'Combo Light',
        memberResults: [makeMR('m1', [10, 10], [2, 2], [1, 1])],
      },
      {
        comboId: 'c2',
        comboName: 'Combo Heavy',
        memberResults: [makeMR('m1', [500, 500], [100, 100], [50, 50])],
      },
    ]

    const results = performDesignCheckEnvelope(perComboResults, members, nodes, profiles, 250)
    expect(results).toHaveLength(1)
    expect(results[0].memberId).toBe('m1')
    expect(results[0].governingCombo).toBe('Combo Heavy')
    expect(results[0].UR_combined).toBeGreaterThan(0)
  })

  it('handles single combo as trivial envelope', () => {
    const perComboResults: PerComboResult[] = [
      {
        comboId: 'c1',
        comboName: 'Only Combo',
        memberResults: [makeMR('m1', [50], [10], [5])],
      },
    ]

    const results = performDesignCheckEnvelope(perComboResults, members, nodes, profiles, 250)
    expect(results[0].governingCombo).toBe('Only Combo')
  })

  it('returns empty when no combos', () => {
    const results = performDesignCheckEnvelope([], members, nodes, profiles, 250)
    expect(results).toHaveLength(0)
  })
})
