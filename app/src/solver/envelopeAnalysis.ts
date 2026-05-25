import type { MemberResult, MemberEnvelope, MemberDiagramEnvelope, PerComboResult } from '@/types/solver'

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
    let maxAbsV = 0
    let maxAbsV_combo = ''
    let maxAbsM = 0
    let maxAbsM_combo = ''

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

      const localMaxV = Math.max(...mr.V.map(Math.abs), 0)
      if (localMaxV > maxAbsV) {
        maxAbsV = localMaxV
        maxAbsV_combo = comboId
      }

      const localMaxM = Math.max(...mr.M.map(Math.abs), 0)
      if (localMaxM > maxAbsM) {
        maxAbsM = localMaxM
        maxAbsM_combo = comboId
      }
    }

    envelopes.push({
      memberId,
      maxTensionN,
      maxTensionN_combo,
      maxCompressionN,
      maxCompressionN_combo,
      maxAbsV,
      maxAbsV_combo,
      maxAbsM,
      maxAbsM_combo,
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
    const inf = Infinity
    const minN = new Array(n).fill(inf)
    const maxN = new Array(n).fill(-inf)
    const minV = new Array(n).fill(inf)
    const maxV = new Array(n).fill(-inf)
    const minM = new Array(n).fill(inf)
    const maxM = new Array(n).fill(-inf)

    for (const mr of allResults) {
      for (let i = 0; i < n; i++) {
        if (mr.N[i] < minN[i]) minN[i] = mr.N[i]
        if (mr.N[i] > maxN[i]) maxN[i] = mr.N[i]
        if (mr.V[i] < minV[i]) minV[i] = mr.V[i]
        if (mr.V[i] > maxV[i]) maxV[i] = mr.V[i]
        if (mr.M[i] < minM[i]) minM[i] = mr.M[i]
        if (mr.M[i] > maxM[i]) maxM[i] = mr.M[i]
      }
    }

    result.push({ memberId, stations, minN, maxN, minV, maxV, minM, maxM })
  }

  return result
}

export function envelopeToMemberResult(e: MemberEnvelope): MemberResult {
  const criticalN =
    e.maxCompressionN >= e.maxTensionN ? -e.maxCompressionN : e.maxTensionN
  return {
    memberId: e.memberId,
    stations: [0, 1],
    N: [criticalN, criticalN],
    V: [e.maxAbsV, e.maxAbsV],
    M: [e.maxAbsM, e.maxAbsM],
    endForces: [criticalN, e.maxAbsV, e.maxAbsM, criticalN, e.maxAbsV, e.maxAbsM],
  }
}
