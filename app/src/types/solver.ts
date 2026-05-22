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
