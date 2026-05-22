import type { StructureNode, Member, StructureType } from '@/types/structure'
import type { Load } from '@/types/loads'
import type { SolverResult } from '@/types/solver'
import { buildDofMap, totalDof } from './dof'
import { assembleGlobalK } from './assembler'
import { assembleForceVector } from './loadVector'
import { applyBoundaryConditions } from './boundaryConditions'
import { solve } from './linearSolve'
import { extractDisplacements, computeReactions, computeMemberResults } from './postProcessor'

export function runFemAnalysis(
  nodes: StructureNode[],
  members: Member[],
  loads: Load[],
  structureType: StructureType,
): SolverResult {
  if (nodes.length < 2) {
    return { success: false, error: 'Need at least 2 nodes.', nodeResults: [], reactions: [], memberResults: [], timestamp: Date.now() }
  }
  if (members.length < 1) {
    return { success: false, error: 'Need at least 1 member.', nodeResults: [], reactions: [], memberResults: [], timestamp: Date.now() }
  }

  const hasSupport = nodes.some(n => n.support !== 'free')
  if (!hasSupport) {
    return { success: false, error: 'Structure has no supports — it is unstable.', nodeResults: [], reactions: [], memberResults: [], timestamp: Date.now() }
  }

  try {
    const dofMap = buildDofMap(nodes, structureType)
    const nDof = totalDof(nodes, structureType)
    const removedMemberIds = new Set<string>()
    const MAX_ITERATIONS = 50
    let memberResults = [] as ReturnType<typeof computeMemberResults>
    let nodeResults: ReturnType<typeof extractDisplacements> = []
    let reactions: ReturnType<typeof computeReactions> = []
    let converged = false

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // Filter active members (exclude removed tension-only members)
      const activeMembers = members.filter(m => !removedMemberIds.has(m.id))

      // Assemble K and F for active members
      const K = assembleGlobalK(activeMembers, nodes, dofMap, structureType, nDof)
      const F = assembleForceVector(loads, nodes, activeMembers, dofMap, structureType, nDof)
      const KOriginal = K.map(row => [...row])
      const FOriginal = [...F]

      // Apply BC and solve
      const { Kbc, Fbc } = applyBoundaryConditions(K, F, nodes, dofMap, structureType)
      const d = solve(Kbc, Fbc)

      // Extract results for active members
      const activeMemberResults = computeMemberResults(activeMembers, nodes, d, dofMap, loads, structureType)
      nodeResults = extractDisplacements(d, nodes, dofMap)
      reactions = computeReactions(KOriginal, d, FOriginal, nodes, dofMap, structureType)

      // Check for tension-only members in compression
      const newlyRemoved: string[] = []
      for (const mr of activeMemberResults) {
        const member = members.find(m => m.id === mr.memberId)
        if (member?.tensionOnly && mr.N[0] < 0) {
          removedMemberIds.add(member.id)
          newlyRemoved.push(member.id)
        }
      }

      if (newlyRemoved.length === 0) {
        // Converged — add zero results for removed members
        const zeroResult = (m: Member) => ({
          memberId: m.id,
          stations: [0, 0.5, 1],
          N: [0, 0, 0],
          V: [0, 0, 0],
          M: [0, 0, 0],
          endForces: [0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number],
        })
        const removedResults = members
          .filter(m => removedMemberIds.has(m.id))
          .map(zeroResult)

        memberResults = [...activeMemberResults, ...removedResults].sort((a, b) =>
          members.findIndex(m => m.id === a.memberId) - members.findIndex(m => m.id === b.memberId)
        )
        converged = true
        break
      }
    }

    if (!converged) {
      return {
        success: false,
        error: 'Tension-only iteration did not converge — structure may be unstable.',
        nodeResults: [], reactions: [], memberResults: [], timestamp: Date.now(),
      }
    }

    return { success: true, nodeResults, reactions, memberResults, timestamp: Date.now() }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Solver error — check structure geometry and supports.',
      nodeResults: [], reactions: [], memberResults: [], timestamp: Date.now(),
    }
  }
}
