import type { Load, PointLoad, DistributedLoad, MomentLoad } from '@/types/loads'
import type { LoadCombination } from '@/types/loadCases'

function scaleLoad(load: Load, factor: number): Load {
  if (load.type === 'point_load') {
    return { ...load, fx: load.fx * factor, fy: load.fy * factor }
  }
  if (load.type === 'distributed_load') {
    return { ...load, w1: load.w1 * factor, w2: load.w2 * factor }
  }
  return { ...load, mz: (load as MomentLoad).mz * factor }
}

export function buildFactoredLoads(loads: Load[], combo: LoadCombination): Load[] {
  return combo.factors.flatMap(({ case: caseId, factor }) =>
    loads
      .filter(l => (l.loadCase ?? 'D') === caseId)
      .map(l => scaleLoad(l, factor)),
  )
}
