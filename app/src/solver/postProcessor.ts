import type { StructureNode, Member, StructureType } from '@/types/structure'
import type { Load, DistributedLoad } from '@/types/loads'
import type { NodeResult, ReactionResult, MemberResult } from '@/types/solver'
import { memberLength, memberAngle } from '@/utils/geometry'

const STATIONS = 21

function mm4ToM4(mm4: number): number { return mm4 * 1e-12 }
function mmToM2(mm2: number): number { return mm2 * 1e-6 }
function mpaToKnM2(mpa: number): number { return mpa * 1e3 }

export function extractDisplacements(
  d: number[],
  nodes: StructureNode[],
  dofMap: Map<string, number[]>,
): NodeResult[] {
  return nodes.map(node => {
    const dofs = dofMap.get(node.id)!
    return {
      nodeId: node.id,
      ux: (d[dofs[0]] ?? 0) * 1000,  // convert m → mm
      uy: (d[dofs[1]] ?? 0) * 1000,
      rz: d[dofs[2]] ?? 0,
    }
  })
}

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

  for (const node of nodes) {
    if (node.support === 'free') continue
    const dofs = dofMap.get(node.id)!
    // Reaction = K*d - F_applied for constrained DOFs
    let rx = 0, ry = 0, mz = 0
    for (let j = 0; j < nDof; j++) {
      rx += KOriginal[dofs[0]][j] * d[j]
      ry += KOriginal[dofs[1]][j] * d[j]
      if (dofs.length >= 3 && structureType === 'frame')
        mz += KOriginal[dofs[2]][j] * d[j]
    }
    rx -= F[dofs[0]]
    ry -= F[dofs[1]]
    if (dofs.length >= 3 && structureType === 'frame') mz -= F[dofs[2]]

    reactions.push({ nodeId: node.id, rx, ry, mz })
  }
  return reactions
}

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
    const L = memberLength(n1.x, n1.y, n2.x, n2.y)
    const angle = memberAngle(n1.x, n1.y, n2.x, n2.y)
    const c = Math.cos(angle)
    const s = Math.sin(angle)

    const d1 = dofMap.get(member.startNodeId)!
    const d2 = dofMap.get(member.endNodeId)!

    const E = mpaToKnM2(member.E)
    const A = mmToM2(member.A)
    const I = mm4ToM4(member.I)
    const isTruss = structureType === 'truss' || member.isTruss

    // Global displacements at member ends
    const ug = [d[d1[0]], d[d1[1]], d1.length >= 3 ? d[d1[2]] : 0,
                 d[d2[0]], d[d2[1]], d2.length >= 3 ? d[d2[2]] : 0]

    // Transform to local: ul = T * ug
    const ul = [
      c * ug[0] + s * ug[1],
      -s * ug[0] + c * ug[1],
      ug[2],
      c * ug[3] + s * ug[4],
      -s * ug[3] + c * ug[4],
      ug[5],
    ]

    let N1: number, V1: number, M1: number, N2: number, V2: number, M2: number

    if (isTruss) {
      N1 = E * A / L * (ul[3] - ul[0])
      N2 = -N1
      V1 = 0; M1 = 0; V2 = 0; M2 = 0
    } else {
      N1 = E * A / L * (ul[3] - ul[0])
      N2 = -N1
      V1 = E * I / (L * L * L) * (12 * ul[1] + 6 * L * ul[2] - 12 * ul[4] + 6 * L * ul[5])
      M1 = E * I / (L * L) * (6 * ul[1] + 4 * L * ul[2] - 6 * ul[4] + 2 * L * ul[5])
      V2 = -V1
      M2 = E * I / (L * L) * (6 * ul[1] + 2 * L * ul[2] - 6 * ul[4] + 4 * L * ul[5])
    }

    // Get distributed loads on this member
    const distLoads = loads.filter(l => l.type === 'distributed_load' && (l as DistributedLoad).memberId === member.id) as DistributedLoad[]

    // Sample N, V, M along member
    const stations = Array.from({ length: STATIONS }, (_, i) => i / (STATIONS - 1))
    const N: number[] = []
    const V: number[] = []
    const M: number[] = []

    for (const xi of stations) {
      const x = xi * L
      let n = N1
      let v = V1
      let m = M1 + V1 * x

      for (const dl of distLoads) {
        // ∫₀ˣ [w1 + (w2-w1)·ξ/L] dξ = w1·x + (w2-w1)·x²/(2L)
        const ddw = dl.w2 - dl.w1
        v -= dl.w1 * x + ddw * x * x / (2 * L)
        m -= dl.w1 * x * x / 2 + ddw * x * x * x / (6 * L)
      }

      N.push(n)
      V.push(v)
      M.push(m)
    }

    return {
      memberId: member.id,
      stations,
      N,
      V,
      M,
      endForces: [N1, V1, M1, N2, V2, M2],
    }
  })
}
