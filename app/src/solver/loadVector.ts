import type { StructureNode, Member, StructureType } from '@/types/structure'
import type { Load, DistributedLoad } from '@/types/loads'
import { memberLength, memberAngle } from '@/utils/geometry'

function mmToM2(mm2: number): number { return mm2 * 1e-6 }

/**
 * Assemble global force vector.
 * Distributed loads are converted to equivalent fixed-end forces.
 * Units: kN and meters.
 */
export function assembleForceVector(
  loads: Load[],
  nodes: StructureNode[],
  members: Member[],
  dofMap: Map<string, number[]>,
  structureType: StructureType,
  nDof: number,
): number[] {
  const F = new Array(nDof).fill(0)

  for (const load of loads) {
    if (load.type === 'point_load') {
      const dofs = dofMap.get(load.nodeId)
      if (!dofs) continue
      F[dofs[0]] += load.fx
      F[dofs[1]] += load.fy
    } else if (load.type === 'moment' && structureType === 'frame') {
      const dofs = dofMap.get(load.nodeId)
      if (!dofs || dofs.length < 3) continue
      F[dofs[2]] += load.mz
    } else if (load.type === 'distributed_load') {
      applyDistributedLoad(load, members, nodes, dofMap, F)
    }
  }

  return F
}

function applyDistributedLoad(
  load: DistributedLoad,
  members: Member[],
  nodes: StructureNode[],
  dofMap: Map<string, number[]>,
  F: number[],
) {
  const member = members.find(m => m.id === load.memberId)
  if (!member) return
  const n1 = nodes.find(n => n.id === member.startNodeId)!
  const n2 = nodes.find(n => n.id === member.endNodeId)!
  const L = memberLength(n1.x, n1.y, n2.x, n2.y)
  const angle = memberAngle(n1.x, n1.y, n2.x, n2.y)
  const w1 = load.w1
  const w2 = load.w2

  // Uniform part (average) and linearly varying part
  const wAvg = (w1 + w2) / 2
  const dw = w2 - w1

  // Fixed-end reactions for UDL (wAvg) in local coords:
  // Fy1 = wAvg*L/2, M1 = wAvg*L²/12, Fy2 = wAvg*L/2, M2 = -wAvg*L²/12
  // Linearly varying (dw from 0 to dw over L):
  // Fy1 = 7*dw*L/20 (at start), Fy2 = 3*dw*L/20 (but sign convention varies)
  // Using consistent fixed-end force formulas:
  const fy1_local = wAvg * L / 2 + 3 * dw * L / 20
  const m1_local = wAvg * L * L / 12 + dw * L * L / 30
  const fy2_local = wAvg * L / 2 + 7 * dw * L / 20
  const m2_local = -(wAvg * L * L / 12 + dw * L * L / 20)

  // Rotate from local to global (load direction in global_y is already vertical)
  // For local_y loads, the local y-axis is perpendicular to member
  const c = Math.cos(angle)
  const s = Math.sin(angle)

  let fx1g: number, fy1g: number, fx2g: number, fy2g: number

  if (load.direction === 'local_y') {
    // Local y is perpendicular to member axis
    fx1g = -fy1_local * s
    fy1g = fy1_local * c
    fx2g = -fy2_local * s
    fy2g = fy2_local * c
  } else {
    // Global y — loads act vertically
    // Project global load onto local axes, then compute fixed-end forces
    // Simplified: treat w as vertical load, map to local y component
    const wy = wAvg  // global y load
    const wy1_local = wy  // simplified for near-horizontal members
    const fy1_gbl = wy1_local * L / 2
    const fy2_gbl = wy1_local * L / 2
    fx1g = 0
    fy1g = fy1_gbl
    fx2g = 0
    fy2g = fy2_gbl
  }

  const dofs1 = dofMap.get(member.startNodeId)!
  const dofs2 = dofMap.get(member.endNodeId)!

  F[dofs1[0]] += fx1g
  F[dofs1[1]] += fy1g
  if (dofs1.length >= 3) F[dofs1[2]] += m1_local

  F[dofs2[0]] += fx2g
  F[dofs2[1]] += fy2g
  if (dofs2.length >= 3) F[dofs2[2]] += m2_local
}
