export type ProfileStandard = 'TIS' | 'JIS' | 'ASTM' | 'EN'
export type ProfileClass = 'H' | 'I' | 'C' | 'L' | 'RHS' | 'CHS' | 'RoundPipe' | 'WideFlange' | 'LightLipChannel'

export interface SteelProfile {
  id: string
  standard: ProfileStandard
  profileClass: ProfileClass
  designation: string
  d: number
  bf: number
  tf: number
  tw: number
  r: number
  A: number
  Ix: number
  Iy: number
  Sx: number
  Zx: number
  rx: number
  ry: number
  mass: number
  E: number
  Fy: number
}
