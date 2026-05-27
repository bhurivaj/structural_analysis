import type { StructureNode, Member, StructureType } from '@/types/structure'
import type { Load, DistributedLoad } from '@/types/loads'
import { memberDirectionCosines } from './geometry3D'

/**
 * Assemble global force vector (3D, always 6 DOF/node for frames, 3 DOF/node for trusses).
 * Frame DOF order: [ux, uy, uz, θx, θy, θz] at each node.
 * Truss DOF order: [ux, uy, uz] at each node.
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
  const isFrame = structureType === 'frame'

  for (const load of loads) {
    if (load.type === 'point_load') {
      const dofs = dofMap.get(load.nodeId)
      if (!dofs) continue
      F[dofs[0]] += load.fx
      F[dofs[1]] += load.fy
      if (load.fz && dofs.length >= 3) F[dofs[2]] += load.fz
    } else if (load.type === 'moment' && isFrame) {
      const dofs = dofMap.get(load.nodeId)
      // In 3D frame: θz is DOF index 5
      if (!dofs || dofs.length < 6) continue
      F[dofs[5]] += load.mz
    } else if (load.type === 'distributed_load' && isFrame) {
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
  const { L, l: cx, m: cy } = memberDirectionCosines(n1, n2)
  const w1 = load.w1
  const w2 = load.w2

  // Fixed-end forces (local y): Superposition of UDL(w1) + triangular(dw=w2-w1)
  const dw = w2 - w1
  const fy1_local = w1 * L / 2 + 3 * dw * L / 20   // = (7w1+3w2)L/20
  const m1_local  = w1 * L * L / 12 + dw * L * L / 30
  const fy2_local = w1 * L / 2 + 7 * dw * L / 20   // = (3w1+7w2)L/20
  const m2_local  = -(w1 * L * L / 12 + dw * L * L / 20)

  // In 3D frame, 2D angle = atan2(cy, cx) for members in XY plane
  // For the load rotation: local y ⊥ member axis in XY plane → use 2D projection angle
  const angle = Math.atan2(cy, cx)
  const c = Math.cos(angle)
  const s = Math.sin(angle)

  let fx1g: number, fy1g: number, fx2g: number, fy2g: number

  if (load.direction === 'local_y') {
    fx1g = -fy1_local * s
    fy1g =  fy1_local * c
    fx2g = -fy2_local * s
    fy2g =  fy2_local * c
  } else {
    // Global y — vertical load, simplified
    const wAvg = (w1 + w2) / 2
    fx1g = 0;  fy1g = wAvg * L / 2
    fx2g = 0;  fy2g = wAvg * L / 2
  }

  const dofs1 = dofMap.get(member.startNodeId)!
  const dofs2 = dofMap.get(member.endNodeId)!

  // 3D frame DOF layout: [ux=0, uy=1, uz=2, θx=3, θy=4, θz=5] at each node
  F[dofs1[0]] += fx1g
  F[dofs1[1]] += fy1g
  F[dofs1[5]] += m1_local   // θz DOF

  F[dofs2[0]] += fx2g
  F[dofs2[1]] += fy2g
  F[dofs2[5]] += m2_local   // θz DOF
}
