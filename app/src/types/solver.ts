export interface NodeResult {
  nodeId: string
  ux: number
  uy: number
  rz: number
}

export interface ReactionResult {
  nodeId: string
  rx: number
  ry: number
  mz: number
}

export interface MemberResult {
  memberId: string
  stations: number[]
  N: number[]
  V: number[]
  M: number[]
  endForces: number[]
}

export interface SolverResult {
  success: boolean
  error?: string
  nodeResults: NodeResult[]
  reactions: ReactionResult[]
  memberResults: MemberResult[]
  timestamp: number
}

export interface MemberDiagramEnvelope {
  memberId: string
  stations: number[]
  minN: number[]
  maxN: number[]
  minV: number[]
  maxV: number[]
  minM: number[]
  maxM: number[]
}

export interface MemberEnvelope {
  memberId: string
  maxTensionN: number
  maxTensionN_combo: string
  maxCompressionN: number
  maxCompressionN_combo: string
  maxAbsV: number
  maxAbsV_combo: string
  maxAbsM: number
  maxAbsM_combo: string
}

export interface PerComboResult {
  comboId: string
  comboName: string
  memberResults: MemberResult[]
}

export interface EnvelopeResult {
  success: boolean
  error?: string
  envelopes: MemberEnvelope[]
  perComboResults: PerComboResult[]
  combinationNames: Record<string, string>
  diagramEnvelopes?: MemberDiagramEnvelope[]
  timestamp: number
}
