export type SupportType = 'free' | 'pinned' | 'roller' | 'fixed'
export type RollerAxis = 'x' | 'y'
export type StructureType = 'frame' | 'truss'

export interface StructureNode {
  id: string
  x: number
  y: number
  z?: number
  support: SupportType
  rollerAxis?: RollerAxis
  label?: string
}

export interface Member {
  id: string
  startNodeId: string
  endNodeId: string
  steelProfileId: string | null
  E: number
  A: number
  I: number
  isTruss: boolean
  tensionOnly?: boolean
  label?: string
}
