import { lusolve } from 'mathjs'

export function solve(K: number[][], F: number[]): number[] {
  const result = lusolve(K, F) as number[][]
  return result.map(row => row[0])
}
