import { describe, it, expect } from 'vitest'
import { buildFactoredLoads } from '../buildFactoredLoads'
import type { Load } from '@/types/loads'
import type { LoadCombination } from '@/types/loadCases'

const deadPoint: Load = { id: 'p1', type: 'point_load', nodeId: 'n1', fx: 0, fy: -10, loadCase: 'D' }
const livePoint: Load = { id: 'p2', type: 'point_load', nodeId: 'n2', fx: 0, fy: -5, loadCase: 'L' }
const windDist: Load = { id: 'd1', type: 'distributed_load', memberId: 'm1', w1: -2, w2: -2, direction: 'global_y', loadCase: 'W' }
const momentLoad: Load = { id: 'm1', type: 'moment', nodeId: 'n1', mz: 10, loadCase: 'D' }
const noCase: Load = { id: 'p3', type: 'point_load', nodeId: 'n3', fx: 3, fy: 0 }

const combo12DL: LoadCombination = {
  id: 'lc2', name: '1.2D + 1.6L', factors: [{ case: 'D', factor: 1.2 }, { case: 'L', factor: 1.6 }],
}
const comboServiceDL: LoadCombination = {
  id: 'service', name: 'Service', factors: [{ case: 'D', factor: 1.0 }, { case: 'L', factor: 1.0 }],
}
const comboDOnly: LoadCombination = {
  id: 'lc1', name: '1.4D', factors: [{ case: 'D', factor: 1.4 }],
}
const comboZeroFactor: LoadCombination = {
  id: 'z', name: 'Zero', factors: [{ case: 'D', factor: 0 }],
}

describe('buildFactoredLoads', () => {
  it('scales point load fx/fy by factor', () => {
    const result = buildFactoredLoads([deadPoint], comboDOnly)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ type: 'point_load', fy: -10 * 1.4 })
  })

  it('scales distributed load w1/w2 by factor', () => {
    const combo: LoadCombination = { id: 'w', name: '1.0W', factors: [{ case: 'W', factor: 1.0 }] }
    const result = buildFactoredLoads([windDist], combo)
    expect(result[0]).toMatchObject({ w1: -2, w2: -2 })
  })

  it('scales moment load mz by factor', () => {
    const result = buildFactoredLoads([momentLoad], comboDOnly)
    expect(result[0]).toMatchObject({ type: 'moment', mz: 10 * 1.4 })
  })

  it('filters out loads not in combination', () => {
    const result = buildFactoredLoads([deadPoint, livePoint, windDist], comboDOnly)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('p1')
  })

  it('applies 1.2D + 1.6L to correct loads', () => {
    const result = buildFactoredLoads([deadPoint, livePoint, windDist], combo12DL)
    expect(result).toHaveLength(2)
    const d = result.find(l => l.id === 'p1') as any
    const l = result.find(l => l.id === 'p2') as any
    expect(d.fy).toBeCloseTo(-12)
    expect(l.fy).toBeCloseTo(-8)
  })

  it('load without loadCase defaults to D', () => {
    const result = buildFactoredLoads([noCase], comboDOnly)
    expect(result).toHaveLength(1)
    expect((result[0] as any).fx).toBeCloseTo(3 * 1.4)
  })

  it('zero factor produces load with all-zero values', () => {
    const result = buildFactoredLoads([deadPoint], comboZeroFactor)
    expect(result).toHaveLength(1)
    expect((result[0] as any).fy).toBeCloseTo(0)
  })

  it('returns empty array when no loads match combination', () => {
    const windOnly: LoadCombination = { id: 'w', name: 'Wind', factors: [{ case: 'W', factor: 1.0 }] }
    const result = buildFactoredLoads([deadPoint, livePoint], windOnly)
    expect(result).toHaveLength(0)
  })

  it('preserves load id and other fields on scaled copy', () => {
    const result = buildFactoredLoads([deadPoint], comboServiceDL)
    expect(result[0].id).toBe('p1')
    expect((result[0] as any).nodeId).toBe('n1')
    expect(result[0]).not.toBe(deadPoint)
  })
})
