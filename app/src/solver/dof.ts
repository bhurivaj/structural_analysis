import type { StructureNode } from '@/types/structure'
import type { StructureType } from '@/types/structure'

export const DOF_PER_NODE: Record<StructureType, number> = {
  frame: 3,
  truss: 2,
}

export function buildDofMap(nodes: StructureNode[], structureType: StructureType): Map<string, number[]> {
  const dofPerNode = DOF_PER_NODE[structureType]
  const map = new Map<string, number[]>()
  nodes.forEach((node, i) => {
    const base = i * dofPerNode
    const dofs = Array.from({ length: dofPerNode }, (_, k) => base + k)
    map.set(node.id, dofs)
  })
  return map
}

export function totalDof(nodes: StructureNode[], structureType: StructureType): number {
  return nodes.length * DOF_PER_NODE[structureType]
}
