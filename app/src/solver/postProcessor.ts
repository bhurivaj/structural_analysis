import type { StructureNode, Member, StructureType } from '@/types/structure'
import type { Load, DistributedLoad } from '@/types/loads'
import type { NodeResult, ReactionResult, MemberResult } from '@/types/solver'
import { memberDirectionCosines, localAxisFrame, transformationMatrix12x12 } from './geometry3D'

const STATIONS = 21

function mm4ToM4(mm4: number): number { return mm4 * 1e-12 }
function mmToM2(mm2: number): number { return mm2 * 1e-6 }
function mpaToKnM2(mpa: number): number { return mpa * 1e3 }

/**
 * Extract node displacements from solution vector.
 * Frame: [ux,uy,uz,rx,ry,rz] (mm for translations, rad for rotations)
 * Truss: [ux,uy,uz] (mm)
 */
export function extractDisplacements(
  d: number[],
  nodes: StructureNode[],
  dofMap: Map<string, number[]>,
): NodeResult[] {
  return nodes.map(node => {
    const dofs = dofMap.get(node.id)!
    const g = (i: number) => (d[dofs[i]] ?? 0)
    return {
      nodeId: node.id,
      ux: g(0) * 1000,  // m → mm
      uy: g(1) * 1000,
      uz: g(2) * 1000,
      rx: dofs.length >= 6 ? g(3) : 0,
      ry: dofs.length >= 6 ? g(4) : 0,
      rz: dofs.length >= 6 ? g(5) : 0,
    }
  })
}

/**
 * Compute support reactions from K·d - F for each constrained node.
 */
export function computeReactions(
  KOriginal: number[][],
  d: number[],
  F: number[],
  nodes: StructureNode[],
  dofMap: Map<string, number[]>,
  structureType: StructureType,
): ReactionResult[] {
  const reactions: ReactionResult[] = []
  const nDof = d.length
  const isFrame = structureType === 'frame'

  for (const node of nodes) {
    if (node.support === 'free') continue
    const dofs = dofMap.get(node.id)!
    const react = dofs.map(dofIdx => {
      let r = 0
      for (let j = 0; j < nDof; j++) r += KOriginal[dofIdx][j] * d[j]
      r -= F[dofIdx]
      return r
    })

    reactions.push({
      nodeId: node.id,
      rx: react[0] ?? 0,
      ry: react[1] ?? 0,
      rz: react[2] ?? 0,
      mx: isFrame ? (react[3] ?? 0) : 0,
      my: isFrame ? (react[4] ?? 0) : 0,
      mz: isFrame ? (react[5] ?? 0) : 0,
    })
  }
  return reactions
}

/**
 * Compute N, Vy, Vz, My, Mz, T along each member (21 stations).
 * V and M are kept as aliases for Vy and Mz for backward compatibility.
 */
export function computeMemberResults(
  members: Member[],
  nodes: StructureNode[],
  d: number[],
  dofMap: Map<string, number[]>,
  loads: Load[],
  structureType: StructureType,
): MemberResult[] {
  return members.map(member => {
    const n1 = nodes.find(n => n.id === member.startNodeId)!
    const n2 = nodes.find(n => n.id === member.endNodeId)!
    const { L, l, m, n } = memberDirectionCosines(n1, n2)

    const d1 = dofMap.get(member.startNodeId)!
    const d2 = dofMap.get(member.endNodeId)!

    const E = mpaToKnM2(member.E)
    const A = mmToM2(member.A)
    const Iz = mm4ToM4(member.Iz ?? member.I)          // strong axis: gravity/XY bending
    const Iy = mm4ToM4(member.Iy ?? member.I * 0.1)   // weak axis:   lateral/XZ bending
    const G = E / 2.6
    const J = mm4ToM4(member.J ?? member.I * 0.05)
    const isTruss = structureType === 'truss' || member.isTruss

    const stations = Array.from({ length: STATIONS }, (_, i) => i / (STATIONS - 1))
    const N: number[] = [], Vy: number[] = [], Vz: number[] = []
    const My: number[] = [], Mz: number[] = [], T: number[] = []

    if (isTruss) {
      // Truss: DOF [ux1,uy1,uz1, ux2,uy2,uz2]
      const ug = [...d1, ...d2].map(idx => d[idx] ?? 0)
      // Project onto member axis to get axial displacement
      const u1_axial = l * ug[0] + m * ug[1] + n * ug[2]
      const u2_axial = l * ug[3] + m * ug[4] + n * ug[5]
      const N1 = E * A / L * (u2_axial - u1_axial)
      for (let i = 0; i < STATIONS; i++) {
        N.push(N1); Vy.push(0); Vz.push(0); My.push(0); Mz.push(0); T.push(0)
      }
      return {
        memberId: member.id, stations, N,
        Vy, Vz, My, Mz, T,
        V: Vy, M: Mz,
        endForces: [N1, 0, 0, -N1, 0, 0],
      }
    }

    // Frame element: DOF [ux1,uy1,uz1,θx1,θy1,θz1, ux2,uy2,uz2,θx2,θy2,θz2]
    const ug12 = [...d1, ...d2].map(idx => d[idx] ?? 0)

    // Transform global displacements to local
    const { ex, ey, ez } = localAxisFrame(l, m, n)
    const T_mat = transformationMatrix12x12(ex, ey, ez)
    const ul: number[] = new Array(12).fill(0)
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 12; j++)
        ul[i] += T_mat[i][j] * ug12[j]

    // Local DOF: [ux1=0, uy1=1, uz1=2, θx1=3, θy1=4, θz1=5,
    //             ux2=6, uy2=7, uz2=8, θx2=9, θy2=10, θz2=11]
    const N1 = E * A / L * (ul[6] - ul[0])
    const T1 = G * J / L * (ul[9] - ul[3])  // torsion (constant along member)

    // XY bending (Iz): Vy and Mz
    const Vy1 = E * Iz / (L*L*L) * (12*ul[1] + 6*L*ul[5] - 12*ul[7] + 6*L*ul[11])
    const Mz1 = E * Iz / (L*L)   * (6*ul[1]  + 4*L*ul[5] - 6*ul[7]  + 2*L*ul[11])
    const Mz2 = E * Iz / (L*L)   * (6*ul[1]  + 2*L*ul[5] - 6*ul[7]  + 4*L*ul[11])

    // XZ bending (Iy): Vz and My
    // Sign convention: θy = -duz/dx
    const Vz1 = E * Iy / (L*L*L) * (12*ul[2] - 6*L*ul[4] - 12*ul[8] - 6*L*ul[10])
    const My1 = E * Iy / (L*L)   * (-6*ul[2] + 4*L*ul[4] + 6*ul[8]  + 2*L*ul[10])
    const My2 = E * Iy / (L*L)   * (-6*ul[2] + 2*L*ul[4] + 6*ul[8]  + 4*L*ul[10])

    // Distributed loads on this member (in-plane / local_y only for Phase 3)
    const distLoads = loads
      .filter(ld => ld.type === 'distributed_load' && (ld as DistributedLoad).memberId === member.id) as DistributedLoad[]

    for (const xi of stations) {
      const x = xi * L
      let vy = Vy1
      let mz = Mz1 + Vy1 * x

      for (const dl of distLoads) {
        const ddw = dl.w2 - dl.w1
        vy -= dl.w1 * x + ddw * x * x / (2 * L)
        mz -= dl.w1 * x * x / 2 + ddw * x * x * x / (6 * L)
      }

      N.push(N1); Vy.push(vy); Vz.push(Vz1); My.push(My1); Mz.push(mz); T.push(T1)
    }

    return {
      memberId: member.id, stations, N,
      Vy, Vz, My, Mz, T,
      V: Vy, M: Mz,  // backward-compat aliases
      endForces: [N1, Vy1, Mz1, -N1, -Vy1, Mz2],
    }
  })
}
