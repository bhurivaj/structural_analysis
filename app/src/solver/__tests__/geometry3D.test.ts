import { describe, it, expect } from 'vitest'
import {
  memberLength3D,
  memberDirectionCosines,
  localAxisFrame,
  transformationMatrix12x12,
} from '../geometry3D'
import type { StructureNode } from '@/types/structure'

function node(x: number, y: number, z = 0): StructureNode {
  return { id: 'n', x, y, z, support: 'free' }
}

describe('memberLength3D', () => {
  it('2D member (z=0)', () => {
    expect(memberLength3D(node(0, 0), node(3, 4))).toBeCloseTo(5)
  })
  it('3D member diagonal', () => {
    expect(memberLength3D(node(0, 0, 0), node(1, 1, 1))).toBeCloseTo(Math.sqrt(3))
  })
  it('treats missing z as 0', () => {
    const n1: StructureNode = { id: 'a', x: 0, y: 0, support: 'free' }
    const n2: StructureNode = { id: 'b', x: 0, y: 0, z: 3, support: 'free' }
    expect(memberLength3D(n1, n2)).toBeCloseTo(3)
  })
})

describe('memberDirectionCosines', () => {
  it('horizontal X-member', () => {
    const { l, m, n, L } = memberDirectionCosines(node(0, 0), node(5, 0))
    expect(L).toBeCloseTo(5)
    expect(l).toBeCloseTo(1); expect(m).toBeCloseTo(0); expect(n).toBeCloseTo(0)
  })
  it('vertical Y-member', () => {
    const { l, m, n } = memberDirectionCosines(node(0, 0), node(0, 3))
    expect(l).toBeCloseTo(0); expect(m).toBeCloseTo(1); expect(n).toBeCloseTo(0)
  })
  it('diagonal 3D member', () => {
    const { l, m, n } = memberDirectionCosines(node(0, 0, 0), node(1, 1, 1))
    const s = 1 / Math.sqrt(3)
    expect(l).toBeCloseTo(s); expect(m).toBeCloseTo(s); expect(n).toBeCloseTo(s)
  })
})

describe('localAxisFrame', () => {
  it('horizontal X-member: ey ≈ global Y (gravity axis), ez ≈ global Z (transverse)', () => {
    const { ex, ey, ez } = localAxisFrame(1, 0, 0)
    expect(ex).toEqual([1, 0, 0])
    // ey should be (0,1,0) — global up (Gram-Schmidt projection)
    expect(ey[1]).toBeGreaterThan(0.9)
    // ez = cross(ex, ey) = (0,0,1) — horizontal transverse
    expect(ez[2]).toBeGreaterThan(0.9)
  })
  it('vertical Y-member: ey=(1,0,0), ez=cross([0,1,0],[1,0,0])=(0,0,-1)', () => {
    const { ex, ey, ez } = localAxisFrame(0, 1, 0)
    expect(ex).toEqual([0, 1, 0])
    expect(ey).toEqual([1, 0, 0])
    // ez = cross([0,1,0],[1,0,0]) = [1*0-0*0, 0*1-0*0, 0*0-1*1] = [0,0,-1]
    expect(ez).toEqual([0, 0, -1])
  })
  it('ex · ey = 0 (orthogonal)', () => {
    for (const args of [[1, 0, 0], [0, 0, 1], [1/Math.sqrt(2), 1/Math.sqrt(2), 0]] as [number, number, number][]) {
      const [l, m, n] = args
      const { ex, ey } = localAxisFrame(l, m, n)
      const dot = ex[0]*ey[0] + ex[1]*ey[1] + ex[2]*ey[2]
      expect(Math.abs(dot)).toBeLessThan(1e-10)
    }
  })
  it('ex · ez = 0 (orthogonal)', () => {
    const { ex, ez } = localAxisFrame(1, 0, 0)
    const dot = ex[0]*ez[0] + ex[1]*ez[1] + ex[2]*ez[2]
    expect(Math.abs(dot)).toBeLessThan(1e-10)
  })
  it('ey · ez = 0 (orthogonal)', () => {
    const { ey, ez } = localAxisFrame(1, 0, 0)
    const dot = ey[0]*ez[0] + ey[1]*ez[1] + ey[2]*ez[2]
    expect(Math.abs(dot)).toBeLessThan(1e-10)
  })
})

describe('transformationMatrix12x12', () => {
  it('T is 12×12', () => {
    const { ex, ey, ez } = localAxisFrame(1, 0, 0)
    const T = transformationMatrix12x12(ex, ey, ez)
    expect(T.length).toBe(12)
    expect(T[0].length).toBe(12)
  })

  it('T is orthogonal: Tᵀ·T = I', () => {
    const { ex, ey, ez } = localAxisFrame(1, 0, 0)
    const T = transformationMatrix12x12(ex, ey, ez)
    const n = 12
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let sum = 0
        for (let k = 0; k < n; k++) sum += T[k][i] * T[k][j]
        expect(sum).toBeCloseTo(i === j ? 1 : 0, 10)
      }
    }
  })

  it('for member along global X: T maps local→global correctly', () => {
    // For member along X: ex=(1,0,0), so local ux = global ux
    const { ex, ey, ez } = localAxisFrame(1, 0, 0)
    const T = transformationMatrix12x12(ex, ey, ez)
    // T[0][0] should be ex[0] = 1 (ux local = ux global component)
    expect(T[0][0]).toBeCloseTo(1)
  })
})
