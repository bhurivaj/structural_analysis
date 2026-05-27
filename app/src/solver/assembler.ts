import type { StructureNode, Member, StructureType } from '@/types/structure'
import { memberDirectionCosines, localAxisFrame } from './geometry3D'
import { frameElement3D, trussElement3D } from './elementStiffness3D'
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
    const { L, l, m, n } = memberDirectionCosines(n1, n2)

    const E = mpaToKnM2(member.E)
    const A = mmToM2(member.A)
    const G = E / 2.6  // shear modulus (ν ≈ 0.3 for steel)

    const d1 = dofMap.get(member.startNodeId)!
    const d2 = dofMap.get(member.endNodeId)!
    const dofs = [...d1, ...d2]

    const isTruss = structureType === 'truss' || member.isTruss

    let ke: number[][]
    if (isTruss) {
      ke = trussElement3D(L, E, A, l, m, n)
    } else {
      const Iz = mm4ToM4(member.Iz ?? member.I)          // strong axis: gravity/XY bending
      const Iy = mm4ToM4(member.Iy ?? member.I * 0.1)   // weak axis:   lateral/XZ bending
      const J  = mm4ToM4(member.J  ?? member.I * 0.05)
      const { ex, ey, ez } = localAxisFrame(l, m, n)
      ke = frameElement3D(L, E, A, Iy, Iz, G, J, ex, ey, ez)
    }

    for (let i = 0; i < dofs.length; i++)
      for (let j = 0; j < dofs.length; j++)
        K[dofs[i]][dofs[j]] += ke[i][j]
  }

  return K
}
