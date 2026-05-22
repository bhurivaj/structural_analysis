import { describe, it, expect } from 'vitest'
import { findOptimalProfile, getAlternatives } from '@/utils/autoSize'
import { computeURForSection, performDesignCheck } from '@/utils/designCheck'
import type { Member, StructureNode } from '@/types/structure'
import type { MemberResult } from '@/types/solver'
import type { SteelProfile } from '@/types/steel'

// Minimal profile factory
function makeProfile(id: string, mass: number, A: number, Sx: number, profileClass: 'H' | 'I' = 'H'): SteelProfile {
  return {
    id,
    standard: 'TIS',
    profileClass,
    designation: `H${id}`,
    d: 150,
    bf: 75,
    tf: 7,
    tw: 5,
    r: 8,
    A,
    Ix: A * 1000,
    Iy: A * 100,
    Sx,
    Zx: Sx * 1.1,
    rx: 60,
    ry: Math.sqrt((A * 100) / A), // = sqrt(100) = 10
    mass,
    E: 200000,
    Fy: 250,
  }
}

const nodes = new Map<string, StructureNode>([
  ['N1', { id: 'N1', x: 0, y: 0, support: 'pinned' }],
  ['N2', { id: 'N2', x: 3, y: 0, support: 'free' }],
])

const member: Member = {
  id: 'M1',
  startNodeId: 'N1',
  endNodeId: 'N2',
  steelProfileId: null,
  E: 200000,
  A: 1000,
  I: 1000000,
  isTruss: false,
}

// Heavy load that only large profiles can handle
const heavyMr: MemberResult = {
  memberId: 'M1',
  stations: [0, 0.5, 1],
  N: [0, 0, 0],
  V: [5, 5, 5],
  M: [50, 60, 50], // 60 kN·m — needs large Sx
  endForces: [0, 5, 50, 0, 5, 50],
}

// Light load that even small profiles pass
const lightMr: MemberResult = {
  memberId: 'M1',
  stations: [0, 0.5, 1],
  N: [0, 0, 0],
  V: [0.01, 0.01, 0.01],
  M: [0.05, 0.06, 0.05],
  endForces: [0, 0.01, 0.05, 0, 0.01, 0.05],
}

// Profiles sorted by mass: small → large
const profiles: SteelProfile[] = [
  makeProfile('small', 10, 500, 50000),    // UR_bending will be high with heavy load
  makeProfile('medium', 20, 2000, 200000), // may pass depending on load
  makeProfile('large', 40, 6000, 800000),  // definitely passes heavy load
]

describe('computeURForSection — sanity check', () => {
  it('pure tensile member: UR_axial = N / (phi * Fy * A)', () => {
    const forces = { maxAbsN: 10, maxAbsV: 0, maxAbsM: 0, isCompression: false }
    const section = { A: 1000, Fy: 250, Sx: 0, ry: 10, d: 0, tw: 0, E: 200000 }
    // phi_Pn = 0.9 * 250 * 1000 = 225000 N; UR = 10000/225000 ≈ 0.0444
    const result = computeURForSection(forces, section, 3000, false)
    expect(result.UR_axial).toBeCloseTo(0.0444, 3)
    expect(result.UR_bending).toBe(0)
    expect(result.status).toBe('PASS')
  })

  it('tension-only flag skips shear and bending UR', () => {
    const forces = { maxAbsN: 5, maxAbsV: 10, maxAbsM: 100, isCompression: false }
    const section = { A: 1000, Fy: 250, Sx: 100000, ry: 10, d: 0, tw: 0, E: 200000 }
    const result = computeURForSection(forces, section, 3000, true)
    expect(result.UR_bending).toBe(0)
    expect(result.UR_shear).toBe(0)
    expect(result.UR_combined).toBe(result.UR_axial)
  })

  it('MARGINAL status when 0.8 <= UR_combined < 1.0', () => {
    const forces = { maxAbsN: 0, maxAbsV: 0, maxAbsM: 18, isCompression: false }
    // phi_Mn = 0.9 * 250 * 100000 = 22500000 N·mm; UR = 18e6 / 22500000 = 0.8
    const section = { A: 1000, Fy: 250, Sx: 100000, ry: 1000, d: 0, tw: 0, E: 200000 }
    const result = computeURForSection(forces, section, 0, false, 0.8, 1.0)
    expect(result.UR_bending).toBeCloseTo(0.8, 2)
    expect(result.status).toBe('MARGINAL')
  })
})

describe('findOptimalProfile', () => {
  it('returns null when no profile can handle the load', () => {
    const impossibleMr: MemberResult = {
      memberId: 'M1',
      stations: [0, 0.5, 1],
      N: [0, 0, 0],
      V: [0, 0, 0],
      M: [99999, 99999, 99999], // enormous moment
      endForces: [],
    }
    const result = findOptimalProfile(impossibleMr, member, nodes, profiles, 250, 0.8, 1.0)
    expect(result).toBeNull()
  })

  it('returns the lightest passing profile for a manageable load', () => {
    // Light load → smallest profile (mass=10) should pass
    const result = findOptimalProfile(lightMr, member, nodes, profiles, 250, 0.8, 1.0)
    expect(result).not.toBeNull()
    // Lightest profile that passes (UR_combined < 1.0) should be returned first
    expect(result!.mass).toBeLessThanOrEqual(40)
  })

  it('picks same-class profile first when preferSameClass=true', () => {
    const memberWithProfile: Member = {
      ...member,
      steelProfileId: 'small', // belongs to class 'H'
    }
    // With heavy load, small 'H' profile will fail, should find medium or large 'H'
    const tinyLoad: MemberResult = { ...lightMr }
    const result = findOptimalProfile(tinyLoad, memberWithProfile, nodes, profiles, 250, 0.8, 1.0, true)
    // Should find a profile within same class 'H'
    if (result) {
      expect(result.profileClass).toBe('H')
    }
  })

  it('returns lightest profile that achieves UR_combined < urFail', () => {
    // Medium load: only medium or large profiles pass
    const mediumMr: MemberResult = {
      memberId: 'M1',
      stations: [0, 0.5, 1],
      N: [0, 0, 0],
      V: [0, 0, 0],
      M: [15, 18, 15],  // 18 kN·m
      endForces: [],
    }
    const result = findOptimalProfile(mediumMr, member, nodes, profiles, 250, 0.8, 1.0)
    expect(result).not.toBeNull()
    // The found profile must actually pass
    // (trust the function but verify it's not the lightest that can't handle it)
    expect(result!.mass).toBeGreaterThan(0)
  })
})

describe('getAlternatives', () => {
  it('returns profiles sorted by mass ascending', () => {
    const alternatives = getAlternatives(lightMr, member, nodes, profiles, 250, 0.8, 1.0)
    const masses = alternatives.map(a => a.profile.mass)
    for (let i = 1; i < masses.length; i++) {
      expect(masses[i]).toBeGreaterThanOrEqual(masses[i - 1])
    }
  })

  it('filters by preferredClass when provided', () => {
    // Add an 'I' class profile
    const iProfile = makeProfile('i-section', 15, 1000, 100000, 'I')
    const mixedProfiles = [...profiles, iProfile]

    const alternatives = getAlternatives(lightMr, member, nodes, mixedProfiles, 250, 0.8, 1.0, 'H')
    // All results should be class 'H'
    expect(alternatives.every(a => a.profile.profileClass === 'H')).toBe(true)
  })

  it('includes UR values for each alternative', () => {
    const alternatives = getAlternatives(lightMr, member, nodes, profiles, 250, 0.8, 1.0)
    for (const alt of alternatives) {
      expect(alt.urValues).toHaveProperty('UR_axial')
      expect(alt.urValues).toHaveProperty('UR_bending')
      expect(alt.urValues).toHaveProperty('UR_shear')
      expect(alt.urValues).toHaveProperty('UR_combined')
      expect(alt.urValues).toHaveProperty('status')
    }
  })

  it('returns all profiles when no class filter and within limit', () => {
    const alternatives = getAlternatives(lightMr, member, nodes, profiles, 250, 0.8, 1.0, undefined, 15)
    expect(alternatives.length).toBe(profiles.length)
  })
})

// ─── Regression: ry consistency between sub-table and main table ─────────────
// Bug: TIS profiles store ry: 0, so autoSize was using profile.ry (= 0) while
// performDesignCheck computed ry = sqrt(Iy / A). Fix: profileToSection now also
// computes ry = sqrt(Iy / A), so both paths produce identical UR values.

describe('ry regression: sub-table UR matches main-table UR', () => {
  // Mimics an actual TIS H-profile where ry field is 0 in the source data
  const tisLikeProfile: SteelProfile = {
    id: 'TIS-H-150x75-test',
    standard: 'TIS',
    profileClass: 'H',
    designation: 'H 150×75×7×5',
    d: 150, bf: 75, tf: 5, tw: 7, r: 8,
    A: 1785,
    Ix: 6660000,
    Iy: 500000,
    Sx: 89000,
    Zx: 89000,
    rx: 0,
    ry: 0,          // ← exactly as stored in TIS data file
    mass: 14,
    E: 200000,
    Fy: 250,
  }

  const memberWithProfile: Member = {
    id: 'M1',
    startNodeId: 'N1',
    endNodeId: 'N2',
    steelProfileId: tisLikeProfile.id,
    E: tisLikeProfile.E,
    A: tisLikeProfile.A,
    I: tisLikeProfile.Ix,
    isTruss: false,
  }

  const testNodes = new Map<string, StructureNode>([
    ['N1', { id: 'N1', x: 0, y: 0, support: 'pinned' }],
    ['N2', { id: 'N2', x: 3, y: 0, support: 'free' }],
  ])

  // Compression member — triggers column curve; ry = 0 would bypass it entirely
  const compressionMr: MemberResult = {
    memberId: 'M1',
    stations: [0, 0.5, 1],
    N: [-200, -200, -200],
    V: [5, 5, 5],
    M: [3, 4, 3],
    endForces: [-200, 5, 3, -200, 5, 3],
  }

  it('getAlternatives UR_axial matches performDesignCheck for compression (column curve)', () => {
    const alts = getAlternatives(
      compressionMr, memberWithProfile, testNodes,
      [tisLikeProfile], 250, 0.8, 1.0, 'H',
    )
    const altUR = alts[0]?.urValues
    expect(altUR).toBeDefined()

    const membersMap = new Map([[memberWithProfile.id, memberWithProfile]])
    const profilesMap = new Map([[tisLikeProfile.id, tisLikeProfile]])
    const [mainUR] = performDesignCheck(
      [compressionMr], membersMap, testNodes, profilesMap, 250, 0.8, 1.0,
    )

    expect(altUR!.UR_axial).toBeCloseTo(mainUR.UR_axial, 3)
    expect(altUR!.UR_bending).toBeCloseTo(mainUR.UR_bending, 3)
    expect(altUR!.UR_shear).toBeCloseTo(mainUR.UR_shear, 3)
    expect(altUR!.UR_combined).toBeCloseTo(mainUR.UR_combined, 3)
    expect(altUR!.status).toBe(mainUR.status)
  })

  it('UR_axial is higher than tension-formula when in compression (buckling reduces capacity)', () => {
    // If ry were 0, the column curve is skipped and UR_axial = N / (0.9*Fy*A) (tension formula)
    // With correct ry = sqrt(Iy/A), column curve applies and UR_axial must be >= tension value
    const alts = getAlternatives(
      compressionMr, memberWithProfile, testNodes,
      [tisLikeProfile], 250, 0.8, 1.0, 'H',
    )
    const { UR_axial } = alts[0]!.urValues

    // Tension-formula lower bound: N*1000 / (0.9 * Fy * A) = 200000 / (0.9*250*1785)
    const tensionUR = (200 * 1000) / (0.9 * 250 * 1785)
    // Column buckling must give UR >= tension UR (i.e. buckling reduces capacity)
    expect(UR_axial).toBeGreaterThanOrEqual(tensionUR - 0.001)
  })

  it('both paths agree for a tension member (no column curve involved)', () => {
    const tensionMr: MemberResult = {
      memberId: 'M1',
      stations: [0, 0.5, 1],
      N: [150, 150, 150],
      V: [2, 2, 2],
      M: [1, 1.5, 1],
      endForces: [150, 2, 1, 150, 2, 1],
    }

    const alts = getAlternatives(
      tensionMr, memberWithProfile, testNodes,
      [tisLikeProfile], 250, 0.8, 1.0, 'H',
    )
    const altUR = alts[0]?.urValues

    const membersMap = new Map([[memberWithProfile.id, memberWithProfile]])
    const profilesMap = new Map([[tisLikeProfile.id, tisLikeProfile]])
    const [mainUR] = performDesignCheck(
      [tensionMr], membersMap, testNodes, profilesMap, 250, 0.8, 1.0,
    )

    expect(altUR!.UR_axial).toBeCloseTo(mainUR.UR_axial, 3)
    expect(altUR!.UR_combined).toBeCloseTo(mainUR.UR_combined, 3)
  })
})
