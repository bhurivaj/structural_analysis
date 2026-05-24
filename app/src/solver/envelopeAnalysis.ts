import type { MemberResult, MemberEnvelope, PerComboResult } from '@/types/solver'

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
