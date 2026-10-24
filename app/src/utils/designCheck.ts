import type { Member, StructureNode } from '@/types/structure'
import type { MemberResult, PerComboResult } from '@/types/solver'
import type { SteelProfile } from '@/types/steel'
import {
  computeURForSection, forcesFromResult, memberLengthMm, section3DProps,
  type URSectionProps,
} from './urSection'

export { computeURForSection, type URSectionProps, type URForces, type URValues } from './urSection'

export interface DesignCheckResult {
  memberId: string
  memberLabel: string
  profileId: string | null
  profileName?: string
  UR_axial: number
  UR_bending: number
  UR_shear: number
  UR_combined: number
  status: 'PASS' | 'MARGINAL' | 'FAIL'
  suggestion: string
}

export interface EnvelopeDesignCheckResult extends DesignCheckResult {
  governingCombo: string
}

export function performDesignCheck(
  memberResults: MemberResult[],
  members: Map<string, Member>,
  nodes: Map<string, StructureNode>,
  steelProfiles: Map<string, SteelProfile>,
  defaultFy: number,
  urMarginalThreshold = 0.8,
  urFailThreshold = 1.0,
): DesignCheckResult[] {
  const results: DesignCheckResult[] = []

  for (const mr of memberResults) {
    const member = members.get(mr.memberId)
    if (!member) continue

    let profile: SteelProfile | undefined
    let A = member.A
    let Fy = defaultFy
    let Sx = 0
    let Iy = 0
    let d = 0
    let tw = 0
    let E = member.E

    if (member.steelProfileId) {
      profile = steelProfiles.get(member.steelProfileId)
      if (profile) {
        A = profile.A
        Fy = profile.Fy ?? defaultFy
        Sx = profile.Sx ?? 0
        Iy = profile.Iy ?? 0
        d = profile.d ?? 0
        tw = profile.tw ?? 0
        E = profile.E ?? member.E
      }
    }

    const L_mm = memberLengthMm(member, nodes)

    const ry = Iy > 0 ? Math.sqrt(Iy / A) : Math.sqrt(member.I / A)

    const section: URSectionProps = { A, Fy, Sx, ry, d, tw, E, ...(profile && section3DProps(profile)) }
    const forces = forcesFromResult(mr)

    const urValues = computeURForSection(
      forces,
      section,
      L_mm,
      !!member.tensionOnly,
      urMarginalThreshold,
      urFailThreshold,
    )

    const suggestion = getSuggestion(
      urValues.status,
      urValues.UR_axial,
      urValues.UR_bending,
      urValues.UR_shear,
    )

    results.push({
      memberId: mr.memberId,
      memberLabel: member.label || mr.memberId.slice(0, 6),
      profileId: member.steelProfileId,
      profileName: profile?.designation,
      ...urValues,
      suggestion,
    })
  }

  return results
}

export function performDesignCheckEnvelope(
  perComboResults: PerComboResult[],
  members: Map<string, Member>,
  nodes: Map<string, StructureNode>,
  steelProfiles: Map<string, SteelProfile>,
  defaultFy: number,
  urMarginalThreshold = 0.8,
  urFailThreshold = 1.0,
): EnvelopeDesignCheckResult[] {
  const worstPerMember = new Map<string, { result: DesignCheckResult; comboName: string }>()

  for (const { comboName, memberResults } of perComboResults) {
    const results = performDesignCheck(
      memberResults,
      members,
      nodes,
      steelProfiles,
      defaultFy,
      urMarginalThreshold,
      urFailThreshold,
    )
    for (const r of results) {
      const current = worstPerMember.get(r.memberId)
      if (!current || r.UR_combined > current.result.UR_combined) {
        worstPerMember.set(r.memberId, { result: r, comboName })
      }
    }
  }

  return [...worstPerMember.values()].map(({ result, comboName }) => ({
    ...result,
    governingCombo: comboName,
  }))
}

function getSuggestion(
  status: 'PASS' | 'MARGINAL' | 'FAIL',
  UR_axial: number,
  UR_bending: number,
  UR_shear: number,
): string {
  if (status === 'PASS') return 'โครงสร้างอยู่ในเกณฑ์ปลอดภัย'
  if (status === 'MARGINAL') return 'ใกล้ถึงขีดจำกัด — ตรวจสอบ load combination อื่นให้ดี'

  if (UR_shear > Math.max(UR_axial, UR_bending))
    return 'เพิ่ม web thickness (tw) หรือเลือก profile ที่มี area ใหญ่ขึ้น'
  if (UR_axial > 1.0 && UR_bending <= 1.0)
    return 'เพิ่ม Cross-section Area (A) หรือเลือกหน้าตัดที่ใหญ่ขึ้น'
  if (UR_bending > 1.0 && UR_axial <= 1.0)
    return 'เลือกหน้าตัด H-beam หรือ profile ที่มี Sx/Sy สูงกว่า'

  return 'พิจารณา profile ที่ใหญ่ขึ้น หรือเพิ่ม intermediate support'
}
