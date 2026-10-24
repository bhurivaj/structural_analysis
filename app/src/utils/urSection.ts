import type { Member, StructureNode } from '@/types/structure'
import type { MemberResult } from '@/types/solver'
import type { SteelProfile } from '@/types/steel'
import { approximateJ } from '@/solver/approximateJ'
import { memberLength3D } from '@/solver/geometry3D'

export interface URSectionProps {
  A: number
  Fy: number
  Sx: number
  ry: number
  d: number
  tw: number
  E: number
  // 3D (optional — 0/absent skips that check)
  Sy?: number   // weak-axis elastic modulus, mm³
  Avz?: number  // weak-axis shear area, mm²
  Ct?: number   // torsional modulus, mm³ (τ = T / Ct)
}

export interface URForces {
  maxAbsN: number
  maxAbsV: number
  maxAbsM: number
  isCompression: boolean
  maxAbsVz?: number
  maxAbsMy?: number
  maxAbsT?: number
}

export interface URValues {
  UR_axial: number
  UR_bending: number
  UR_shear: number
  UR_combined: number
  status: 'PASS' | 'MARGINAL' | 'FAIL'
}

const absMax = (arr: number[] | undefined) => Math.max(...(arr ?? []).map(Math.abs), 0)

export function forcesFromResult(mr: MemberResult): URForces {
  const criticalNIndex = mr.N.reduce(
    (idx, v, i) => (Math.abs(v) > Math.abs(mr.N[idx]) ? i : idx),
    0,
  )
  return {
    maxAbsN: absMax(mr.N),
    maxAbsV: absMax(mr.V),
    maxAbsM: absMax(mr.M),
    isCompression: mr.N[criticalNIndex] < 0,
    // ?? [] in absMax: legacy cached results have no 3D arrays
    maxAbsVz: absMax(mr.Vz),
    maxAbsMy: absMax(mr.My),
    maxAbsT: absMax(mr.T),
  }
}

export function memberLengthMm(member: Member, nodes: Map<string, StructureNode>): number {
  const start = nodes.get(member.startNodeId)
  const end = nodes.get(member.endNodeId)
  return start && end ? memberLength3D(start, end) * 1000 : 0
}

/** Weak-axis bending, weak-axis shear and torsion properties derived from a profile. */
export function section3DProps(p: SteelProfile): Required<Pick<URSectionProps, 'Sy' | 'Avz' | 'Ct'>> {
  const t = Math.min(p.tf, p.tw) || p.tf || p.tw
  switch (p.profileClass) {
    case 'CHS':
    case 'RoundPipe':
      // AISC H3.1(b) round HSS: C = π(D−t)²t/2
      return { Sy: p.Sx, Avz: p.A / 2, Ct: (Math.PI * (p.d - t) ** 2 * t) / 2 }
    case 'RHS':
      // AISC H3.1(c) rectangular HSS: C = 2(B−t)(H−t)t − 4.5(4−π)t³
      return {
        Sy: p.bf > 0 ? p.Iy / (p.bf / 2) : 0,
        Avz: 2 * p.bf * t,
        Ct: 2 * (p.bf - t) * (p.d - t) * t - 4.5 * (4 - Math.PI) * t ** 3,
      }
    default: {
      // Open sections — St-Venant shear stress τ = T·t_max/J
      // shortcut: warping torsion (AISC Design Guide 9) not checked; upgrade if open sections carry significant T
      const tMax = Math.max(p.tf, p.tw)
      const asymmetric = p.profileClass === 'C' || p.profileClass === 'LightLipChannel' || p.profileClass === 'L'
      // shortcut: centroid not in data → asymmetric shapes use c = bf (conservative Sy)
      const c = asymmetric ? p.bf : p.bf / 2
      return {
        Sy: c > 0 ? p.Iy / c : 0,
        Avz: (p.profileClass === 'L' ? 1 : 2) * p.bf * p.tf,
        Ct: tMax > 0 ? approximateJ(p) / tMax : 0,
      }
    }
  }
}

export function computeURForSection(
  forces: URForces,
  section: URSectionProps,
  L_mm: number,
  tensionOnly: boolean,
  urMarginalThreshold = 0.8,
  urFailThreshold = 1.0,
): URValues {
  const { maxAbsN, maxAbsV, maxAbsM, isCompression, maxAbsVz = 0, maxAbsMy = 0, maxAbsT = 0 } = forces
  const { A, Fy, Sx, ry, d, tw, E, Sy = 0, Avz = 0, Ct = 0 } = section

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

    // Weak-axis term of H1-1: φMny = 0.9·Fy·Sy (no LTB about weak axis)
    // shortcut: uses Sy (yield) not min(Fy·Zy, 1.6·Fy·Sy) — Zy not in profile data
    if (Sy > 0) UR_bending += (maxAbsMy * 1e6) / (0.9 * Fy * Sy)

    const Av = d > 0 && tw > 0 ? d * tw : 0.6 * A
    const URy = Av > 0 ? (maxAbsV * 1000) / (0.6 * Fy * Av) : 0
    const URz = Avz > 0 ? (maxAbsVz * 1000) / (0.6 * Fy * Avz) : 0
    // Torsion φTn = 0.9·(0.6Fy)·Ct; added linearly to shear (conservative vs H3-6)
    // shortcut: HSS Fcr = 0.6Fy assumes compact walls (no torsional local buckling)
    const URt = Ct > 0 ? (maxAbsT * 1e6) / (0.9 * 0.6 * Fy * Ct) : 0
    UR_shear = Math.max(URy, URz) + URt
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
