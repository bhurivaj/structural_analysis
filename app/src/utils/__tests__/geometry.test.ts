import { describe, it, expect } from 'vitest'
import { memberLength, memberAngle, midpoint } from '@/utils/geometry'

describe('geometry utilities', () => {
  describe('memberLength', () => {
    it('returns 0 for coincident points', () => {
      expect(memberLength(3, 4, 3, 4)).toBe(0)
    })

    it('computes horizontal length correctly', () => {
      expect(memberLength(0, 0, 5, 0)).toBe(5)
    })

    it('computes vertical length correctly', () => {
      expect(memberLength(0, 0, 0, 3)).toBe(3)
    })

    it('computes diagonal length (3-4-5 triangle)', () => {
      expect(memberLength(0, 0, 3, 4)).toBeCloseTo(5, 10)
    })

    it('is symmetric — direction does not matter', () => {
      expect(memberLength(1, 2, 4, 6)).toBeCloseTo(memberLength(4, 6, 1, 2), 10)
    })

    it('handles negative coordinates', () => {
      expect(memberLength(-3, -4, 0, 0)).toBeCloseTo(5, 10)
    })
  })

  describe('memberAngle', () => {
    it('returns 0 for a rightward horizontal member', () => {
      expect(memberAngle(0, 0, 1, 0)).toBeCloseTo(0, 10)
    })

    it('returns π for a leftward horizontal member', () => {
      expect(memberAngle(1, 0, 0, 0)).toBeCloseTo(Math.PI, 10)
    })

    it('returns π/2 for an upward vertical member', () => {
      expect(memberAngle(0, 0, 0, 1)).toBeCloseTo(Math.PI / 2, 10)
    })

    it('returns -π/2 for a downward vertical member', () => {
      expect(memberAngle(0, 1, 0, 0)).toBeCloseTo(-Math.PI / 2, 10)
    })

    it('returns π/4 for a 45-degree diagonal member', () => {
      expect(memberAngle(0, 0, 1, 1)).toBeCloseTo(Math.PI / 4, 10)
    })

    it('range is within (-π, π]', () => {
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) {
        const angle = memberAngle(0, 0, dx, dy)
        expect(angle).toBeGreaterThanOrEqual(-Math.PI)
        expect(angle).toBeLessThanOrEqual(Math.PI)
      }
    })
  })

  describe('midpoint', () => {
    it('computes midpoint of horizontal segment', () => {
      expect(midpoint(0, 0, 4, 0)).toEqual({ x: 2, y: 0 })
    })

    it('computes midpoint of diagonal segment', () => {
      expect(midpoint(0, 0, 2, 4)).toEqual({ x: 1, y: 2 })
    })

    it('is commutative', () => {
      const a = midpoint(1, 3, 5, 7)
      const b = midpoint(5, 7, 1, 3)
      expect(a).toEqual(b)
    })

    it('handles negative coordinates', () => {
      expect(midpoint(-2, -4, 2, 4)).toEqual({ x: 0, y: 0 })
    })
  })
})
