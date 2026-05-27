import type { StructureNode } from '@/types/structure'
import type { StructureType } from '@/types/structure'

/**
 * Apply boundary conditions by the large-number (penalty) method.
 * Constrained DOFs get K[i][i] *= 1e12 and F[i] = 0.
 */
export function applyBoundaryConditions(
  K: number[][],
  F: number[],
  nodes: StructureNode[],
  dofMap: Map<string, number[]>,
  structureType: StructureType,
): { Kbc: number[][], Fbc: number[] } {
  const Kbc = K.map(row => [...row])
  const Fbc = [...F]

  for (const node of nodes) {
    const dofs = dofMap.get(node.id)!
    const constrained = constrainedDofs(node, dofs, structureType)
    for (const dof of constrained) {
      Kbc[dof][dof] *= 1e12
      Fbc[dof] = 0
    }
  }

  return { Kbc, Fbc }
}

function constrainedDofs(node: StructureNode, dofs: number[], structureType: StructureType): number[] {
  // 3D frame DOF order: [ux=0, uy=1, uz=2, θx=3, θy=4, θz=5] at each node
  // 3D truss DOF order: [ux=0, uy=1, uz=2] at each node
  const isFrame = structureType === 'frame'

  switch (node.support) {
    case 'fixed':
      return isFrame
        ? [dofs[0], dofs[1], dofs[2], dofs[3], dofs[4], dofs[5]]
        : [dofs[0], dofs[1], dofs[2]]
    case 'pinned':
      return [dofs[0], dofs[1], dofs[2]]
    case 'roller': {
      const axis = node.rollerAxis ?? 'y'
      if (axis === 'x') return [dofs[0]]
      if (axis === 'z') return [dofs[2]]
      return [dofs[1]]  // default: y
    }
    case 'free':
      return []
  }
}
