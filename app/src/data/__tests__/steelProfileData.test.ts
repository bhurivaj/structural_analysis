import { describe, it, expect } from 'vitest'
import * as data from '@/data/steelProfiles'
import type { SteelProfile } from '@/types/steel'

const all: SteelProfile[] = Object.values(data).flat()
const rolled = all.filter(p => ['H', 'I', 'C', 'WideFlange'].includes(p.profileClass))

describe('TIS steel profile data — flange/web thickness', () => {
  it('has all 374 profiles', () => {
    expect(all).toHaveLength(374)
  })

  it('rolled H/I/C/WideFlange: flange tf ≥ web tw', () => {
    const bad = rolled.filter(p => p.tf < p.tw).map(p => `${p.designation} tf=${p.tf} tw=${p.tw}`)
    expect(bad).toEqual([])
  })

  it('designation d×bf×tf×tw matches stored tf/tw (e.g. H 100×100×8×6 → flange 8, web 6)', () => {
    const bad = rolled
      .map(p => ({ p, n: (p.designation.match(/[\d.]+/g) ?? []).map(Number) }))
      .filter(({ n }) => n.length >= 4)
      .filter(({ p, n }) => p.tf !== n[2] || p.tw !== n[3])
      .map(({ p }) => `${p.designation} tf=${p.tf} tw=${p.tw}`)
    expect(bad).toEqual([])
  })
})
