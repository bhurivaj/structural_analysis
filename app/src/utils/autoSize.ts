import type { MemberResult } from '@/types/solver'
import type { Member, StructureNode } from '@/types/structure'
import type { SteelProfile } from '@/types/steel'
import {
  computeURForSection, forcesFromResult, memberLengthMm, section3DProps,
  type URValues, type URSectionProps,
} from './urSection'

export interface AlternativeResult {
  profile: SteelProfile
  urValues: URValues
}

function profileToSection(profile: SteelProfile): URSectionProps {
  return {
    A: profile.A,
    Fy: profile.Fy,
    Sx: profile.Sx ?? 0,
    ry: profile.Iy > 0 ? Math.sqrt(profile.Iy / profile.A) : 0,
    d: profile.d ?? 0,
    tw: profile.tw ?? 0,
    E: profile.E,
    ...section3DProps(profile),
  }
}

export function getAlternatives(
  mr: MemberResult,
  member: Member,
  nodes: Map<string, StructureNode>,
  profiles: SteelProfile[],
  defaultFy: number,
  urMarginal: number,
  urFail: number,
  preferredClass?: string,
  limit = 15,
): AlternativeResult[] {
  const forces = forcesFromResult(mr)
  const L_mm = memberLengthMm(member, nodes)
  const tensionOnly = !!member.tensionOnly

  let candidates = preferredClass
    ? profiles.filter(p => p.profileClass === preferredClass)
    : profiles

  candidates = [...candidates].sort((a, b) => a.mass - b.mass)
  if (!preferredClass) candidates = candidates.slice(0, limit)

  return candidates.map(profile => {
    const section = profileToSection(profile)
    const urValues = computeURForSection(forces, section, L_mm, tensionOnly, urMarginal, urFail)
    return { profile, urValues }
  })
}

export function findOptimalProfile(
  mr: MemberResult,
  member: Member,
  nodes: Map<string, StructureNode>,
  profiles: SteelProfile[],
  defaultFy: number,
  urMarginal: number,
  urFail: number,
  preferSameClass = true,
): SteelProfile | null {
  const forces = forcesFromResult(mr)
  const L_mm = memberLengthMm(member, nodes)
  const tensionOnly = !!member.tensionOnly

  const currentProfile = profiles.find(p => p.id === member.steelProfileId)
  const currentClass = currentProfile?.profileClass

  let sorted: SteelProfile[]
  if (preferSameClass && currentClass) {
    const sameClass = profiles.filter(p => p.profileClass === currentClass).sort((a, b) => a.mass - b.mass)
    const others = profiles.filter(p => p.profileClass !== currentClass).sort((a, b) => a.mass - b.mass)
    sorted = [...sameClass, ...others]
  } else {
    sorted = [...profiles].sort((a, b) => a.mass - b.mass)
  }

  for (const profile of sorted) {
    const section = profileToSection(profile)
    const urValues = computeURForSection(forces, section, L_mm, tensionOnly, urMarginal, urFail)
    if (urValues.UR_combined < urFail) return profile
  }

  return null
}
