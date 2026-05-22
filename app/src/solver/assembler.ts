import type { StructureNode, Member, StructureType } from '@/types/structure'
import { memberLength, memberAngle } from '@/utils/geometry'
import { frameElementStiffness, trussElementStiffness } from './elementStiffness'
import { totalDof } from './dof'

// All units in kN and meters. E in kN/m², A in m², I in m⁴.
function mmToM2(mm2: number): number { return mm2 * 1e-6 }
function mm4ToM4(mm4: number): number { return mm4 * 1e-12 }
function mpaToKnM2(mpa: number): number { return mpa * 1e3 }

export function assembleGlobalK(
  members: Member[],
  nodes: StructureNode[],
  dofMap: Map<string, number[]>,
  structureType: StructureType,
  nDof: number,
): number[][] {
  const K = Array.from({ length: nDof }, () => new Array(nDof).fill(0))

  for (const member of members) {
    const n1 = nodes.find(n => n.id === member.startNodeId)!
    const n2 = nodes.find(n => n.id === member.endNodeId)!
    const L = memberLength(n1.x, n1.y, n2.x, n2.y)
    const angle = memberAngle(n1.x, n1.y, n2.x, n2.y)

    const E = mpaToKnM2(member.E)
    const A = mmToM2(member.A)
    const I = mm4ToM4(member.I)

    const d1 = dofMap.get(member.startNodeId)!
    const d2 = dofMap.get(member.endNodeId)!
    const dofs = [...d1, ...d2]

    const ke = structureType === 'truss' || member.isTruss
      ? trussElementStiffness(L, E, A, angle)
      : frameElementStiffness(L, E, A, I, angle)

    for (let i = 0; i < dofs.length; i++)
      for (let j = 0; j < dofs.length; j++)
        K[dofs[i]][dofs[j]] += ke[i][j]
  }

  return K
}
