import type { Member, StructureNode } from '@/types/structure'
import type { MemberResult } from '@/types/solver'
import type { SteelProfile } from '@/types/steel'

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

export interface URSectionProps {
  A: number
  Fy: number
  Sx: number
  ry: number
  d: number
  tw: number
  E: number
}

export interface URForces {
  maxAbsN: number
  maxAbsV: number
  maxAbsM: number
  isCompression: boolean
}

export interface URValues {
  UR_axial: number
  UR_bending: number
  UR_shear: number
  UR_combined: number
  status: 'PASS' | 'MARGINAL' | 'FAIL'
}

export function computeURForSection(
  forces: URForces,
  section: URSectionProps,
  L_mm: number,
  tensionOnly: boolean,
  urMarginalThreshold = 0.8,
  urFailThreshold = 1.0,
): URValues {
  const { maxAbsN, maxAbsV, maxAbsM, isCompression } = forces
  const { A, Fy, Sx, ry, d, tw, E } = section

  let UR_axial = 0
  let UR_bending = 0
  let UR_shear = 0

  if (tensionOnly) {
    if (A > 0) {
      const phi_Pn = 0.9 * Fy * A
      UR_axial = (maxAbsN * 1000) / phi_Pn
    }
  } else {
    if (A > 0) {
      if (isCompression && ry > 0 && L_mm > 0) {
        const KL_over_ry = L_mm / ry
        const Fe = (Math.PI ** 2 * E) / (KL_over_ry ** 2)
        const slendernessLimit = 4.71 * Math.sqrt(E / Fy)
        const Fcr =
          KL_over_ry <= slendernessLimit
            ? Math.pow(0.658, Fy / Fe) * Fy
            : 0.877 * Fe
        UR_axial = (maxAbsN * 1000) / (0.9 * Fcr * A)
      } else {
        UR_axial = (maxAbsN * 1000) / (0.9 * Fy * A)
      }
    }

    if (Sx > 0) {
      let phi_Mn: number
      if (ry > 0 && L_mm > 0) {
        const Lp = 1.76 * ry * Math.sqrt(E / Fy)
        phi_Mn = L_mm <= Lp ? 0.9 * Fy * Sx : 0.9 * 0.7 * Fy * Sx
      } else {
        phi_Mn = 0.9 * Fy * Sx
      }
      UR_bending = phi_Mn > 0 ? (maxAbsM * 1e6) / phi_Mn : 0
    }

    const Av = d > 0 && tw > 0 ? d * tw : 0.6 * A
    if (Av > 0) {
      UR_shear = (maxAbsV * 1000) / (0.6 * Fy * Av)
    }
  }

  let UR_combined: number
  if (tensionOnly) {
    UR_combined = UR_axial
  } else {
    const UR_interaction =
      UR_axial >= 0.2
        ? UR_axial + (8 / 9) * UR_bending
        : UR_axial / 2 + UR_bending
    UR_combined = Math.max(UR_interaction, UR_shear)
  }

  let status: 'PASS' | 'MARGINAL' | 'FAIL'
  if (UR_combined < urFailThreshold) {
    status = UR_combined >= urMarginalThreshold ? 'MARGINAL' : 'PASS'
  } else {
    status = 'FAIL'
  }

  return {
    UR_axial: Math.round(UR_axial * 10000) / 10000,
    UR_bending: Math.round(UR_bending * 10000) / 10000,
    UR_shear: Math.round(UR_shear * 10000) / 10000,
    UR_combined: Math.round(UR_combined * 10000) / 10000,
    status,
  }
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

    const maxAbsN = Math.max(...mr.N.map(Math.abs), 0)
    const maxAbsV = Math.max(...mr.V.map(Math.abs), 0)
    const maxAbsM = Math.max(...mr.M.map(Math.abs), 0)

    const criticalNIndex = mr.N.reduce(
      (idx, v, i) => (Math.abs(v) > Math.abs(mr.N[idx]) ? i : idx),
      0,
    )
    const isCompression = mr.N[criticalNIndex] < 0

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

    const startNode = nodes.get(member.startNodeId)
    const endNode = nodes.get(member.endNodeId)
    let L_mm = 0
    if (startNode && endNode) {
      const dx = (endNode.x - startNode.x) * 1000
      const dy = (endNode.y - startNode.y) * 1000
      L_mm = Math.sqrt(dx * dx + dy * dy)
    }

    const ry = Iy > 0 ? Math.sqrt(Iy / A) : Math.sqrt(member.I / A)

    const section: URSectionProps = { A, Fy, Sx, ry, d, tw, E }
    const forces: URForces = { maxAbsN, maxAbsV, maxAbsM, isCompression }

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
    return 'เลือกหน้าตัด H-beam หรือ profile ที่มี Sx สูงกว่า'

  return 'พิจารณา profile ที่ใหญ่ขึ้น หรือเพิ่ม intermediate support'
}
