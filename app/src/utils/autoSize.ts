import type { MemberResult } from '@/types/solver'
import type { Member, StructureNode } from '@/types/structure'
import type { SteelProfile } from '@/types/steel'
import { computeURForSection, type URValues, type URSectionProps, type URForces } from './designCheck'

export interface AlternativeResult {
  profile: SteelProfile
  urValues: URValues
}

function extractForces(mr: MemberResult): URForces {
  const maxAbsN = Math.max(...mr.N.map(Math.abs), 0)
  const maxAbsV = Math.max(...mr.V.map(Math.abs), 0)
  const maxAbsM = Math.max(...mr.M.map(Math.abs), 0)
  const criticalNIndex = mr.N.reduce(
    (idx, v, i) => (Math.abs(v) > Math.abs(mr.N[idx]) ? i : idx),
    0,
  )
  const isCompression = mr.N[criticalNIndex] < 0
  return { maxAbsN, maxAbsV, maxAbsM, isCompression }
}

function memberLengthMm(member: Member, nodes: Map<string, StructureNode>): number {
  const start = nodes.get(member.startNodeId)
  const end = nodes.get(member.endNodeId)
  if (!start || !end) return 0
  const dx = (end.x - start.x) * 1000
  const dy = (end.y - start.y) * 1000
  return Math.sqrt(dx * dx + dy * dy)
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
  const forces = extractForces(mr)
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
  const forces = extractForces(mr)
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
