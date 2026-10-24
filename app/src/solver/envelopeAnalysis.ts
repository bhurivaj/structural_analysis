import type { MemberResult, MemberEnvelope, MemberDiagramEnvelope, PerComboResult } from '@/types/solver'

const ABS_KEYS = ['V', 'M', 'Vz', 'My', 'T'] as const

export function computeEnvelope(perComboResults: PerComboResult[]): MemberEnvelope[] {
  const memberIds = new Set<string>()
  for (const { memberResults } of perComboResults) {
    for (const mr of memberResults) memberIds.add(mr.memberId)
  }

  const envelopes: MemberEnvelope[] = []

  for (const memberId of memberIds) {
    let maxTensionN = 0
    let maxTensionN_combo = ''
    let maxCompressionN = 0
    let maxCompressionN_combo = ''
    const absMax = { V: 0, M: 0, Vz: 0, My: 0, T: 0 }
    const absCombo = { V: '', M: '', Vz: '', My: '', T: '' }

    for (const { comboId, memberResults } of perComboResults) {
      const mr = memberResults.find(r => r.memberId === memberId)
      if (!mr) continue

      for (const n of mr.N) {
        if (n > 0 && n > maxTensionN) {
          maxTensionN = n
          maxTensionN_combo = comboId
        }
        if (n < 0 && Math.abs(n) > maxCompressionN) {
          maxCompressionN = Math.abs(n)
          maxCompressionN_combo = comboId
        }
      }

      for (const key of ABS_KEYS) {
        const local = Math.max(...(mr[key] ?? []).map(Math.abs), 0)
        if (local > absMax[key]) {
          absMax[key] = local
          absCombo[key] = comboId
        }
      }
    }

    envelopes.push({
      memberId,
      maxTensionN,
      maxTensionN_combo,
      maxCompressionN,
      maxCompressionN_combo,
      maxAbsV: absMax.V,
      maxAbsV_combo: absCombo.V,
      maxAbsM: absMax.M,
      maxAbsM_combo: absCombo.M,
      maxAbsVz: absMax.Vz,
      maxAbsVz_combo: absCombo.Vz,
      maxAbsMy: absMax.My,
      maxAbsMy_combo: absCombo.My,
      maxAbsT: absMax.T,
      maxAbsT_combo: absCombo.T,
    })
  }

  return envelopes
}

export function computeEnvelopeDiagrams(perComboResults: PerComboResult[]): MemberDiagramEnvelope[] {
  const memberIds = new Set<string>()
  for (const { memberResults } of perComboResults) {
    for (const mr of memberResults) memberIds.add(mr.memberId)
  }

  const result: MemberDiagramEnvelope[] = []

  for (const memberId of memberIds) {
    const allResults = perComboResults
      .map(r => r.memberResults.find(mr => mr.memberId === memberId))
      .filter(Boolean) as MemberResult[]

    if (allResults.length === 0) continue

    const stations = allResults[0].stations
    const n = stations.length
    const range = (key: 'N' | 'V' | 'M' | 'Vz' | 'My' | 'T') => {
      const min = new Array(n).fill(Infinity)
      const max = new Array(n).fill(-Infinity)
      for (const mr of allResults) {
        const vals = mr[key] ?? []
        for (let i = 0; i < n; i++) {
          const v = vals[i] ?? 0
          if (v < min[i]) min[i] = v
          if (v > max[i]) max[i] = v
        }
      }
      return [min, max]
    }

    const [minN, maxN] = range('N')
    const [minV, maxV] = range('V')
    const [minM, maxM] = range('M')
    const [minVz, maxVz] = range('Vz')
    const [minMy, maxMy] = range('My')
    const [minT, maxT] = range('T')

    result.push({ memberId, stations, minN, maxN, minV, maxV, minM, maxM, minVz, maxVz, minMy, maxMy, minT, maxT })
  }

  return result
}

export function envelopeToMemberResult(e: MemberEnvelope): MemberResult {
  const criticalN =
    e.maxCompressionN >= e.maxTensionN ? -e.maxCompressionN : e.maxTensionN
  const pair = (v = 0) => [v, v]
  return {
    memberId: e.memberId,
    stations: [0, 1],
    N: pair(criticalN),
    V: pair(e.maxAbsV),
    M: pair(e.maxAbsM),
    Vy: pair(e.maxAbsV),
    Vz: pair(e.maxAbsVz),
    My: pair(e.maxAbsMy),
    Mz: pair(e.maxAbsM),
    T: pair(e.maxAbsT),
    endForces: [criticalN, e.maxAbsV, e.maxAbsM, criticalN, e.maxAbsV, e.maxAbsM],
  }
}
