export type SupportType = 'free' | 'pinned' | 'roller' | 'fixed'
export type RollerAxis = 'x' | 'y' | 'z'
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
  Iy?: number  // I about local y-axis (strong axis / gravity bending = profile.Ix)
  Iz?: number  // I about local z-axis (weak axis / lateral bending = profile.Iy)
  J?: number   // torsion constant (approximate)
  isTruss: boolean
  tensionOnly?: boolean
  label?: string
}
