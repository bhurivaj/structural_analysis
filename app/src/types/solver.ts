export interface NodeResult {
  nodeId: string
  ux: number
  uy: number
  uz: number
  rx: number
  ry: number
  rz: number
}

export interface ReactionResult {
  nodeId: string
  rx: number
  ry: number
  rz: number
  mx: number
  my: number
  mz: number
}

export interface MemberResult {
  memberId: string
  stations: number[]
  N: number[]
  V: number[]   // alias for Vy (backward compat with diagram rendering)
  M: number[]   // alias for Mz (backward compat with diagram rendering)
  Vy: number[]
  Vz: number[]
  My: number[]
  Mz: number[]
  T: number[]
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
  minVz?: number[]
  maxVz?: number[]
  minMy?: number[]
  maxMy?: number[]
  minT?: number[]
  maxT?: number[]
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
  maxAbsVz?: number
  maxAbsVz_combo?: string
  maxAbsMy?: number
  maxAbsMy_combo?: string
  maxAbsT?: number
  maxAbsT_combo?: string
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
