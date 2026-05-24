export type LoadCaseCategory = 'D' | 'L' | 'W' | 'E' | 'S'

export interface CaseFactor {
  case: LoadCaseCategory
  factor: number
}

export interface LoadCombination {
  id: string
  name: string
  factors: CaseFactor[]
  isCustom?: boolean
}
