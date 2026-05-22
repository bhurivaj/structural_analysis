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
  const result: number[] = []
  const isFrame = structureType === 'frame'

  switch (node.support) {
    case 'fixed':
      result.push(dofs[0], dofs[1])
      if (isFrame && dofs.length >= 3) result.push(dofs[2])
      break
    case 'pinned':
      result.push(dofs[0], dofs[1])
      break
    case 'roller':
      if (node.rollerAxis === 'x') result.push(dofs[0])
      else result.push(dofs[1])
      break
    case 'free':
      break
  }

  return result
}
