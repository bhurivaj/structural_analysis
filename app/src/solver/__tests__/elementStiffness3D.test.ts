import { describe, it, expect } from 'vitest'
import { frameElement3D, trussElement3D } from '../elementStiffness3D'
import { localAxisFrame } from '../geometry3D'

const E = 200e6   // kN/m²
const G = 80e6    // kN/m²
const A = 0.01    // m²
const Iy = 1e-4   // m⁴ (strong axis)
const Iz = 5e-5   // m⁴ (weak axis)
const J = 1e-5    // m⁴
const L = 5       // m

function axisFrame(l: number, m: number, n: number) {
  return localAxisFrame(l, m, n)
}

describe('frameElement3D', () => {
  it('returns 12×12 matrix', () => {
    const { ex, ey, ez } = axisFrame(1, 0, 0)
    const K = frameElement3D(L, E, A, Iy, Iz, G, J, ex, ey, ez)
    expect(K.length).toBe(12)
    expect(K[0].length).toBe(12)
  })

  it('is symmetric', () => {
    const { ex, ey, ez } = axisFrame(1, 0, 0)
    const K = frameElement3D(L, E, A, Iy, Iz, G, J, ex, ey, ez)
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 12; j++)
        expect(K[i][j]).toBeCloseTo(K[j][i], 8)
  })

  it('axial diagonal term = EA/L', () => {
    const { ex, ey, ez } = axisFrame(1, 0, 0)
    const K = frameElement3D(L, E, A, Iy, Iz, G, J, ex, ey, ez)
    // For member along X, K[0][0] should be EA/L in global X direction
    expect(K[0][0]).toBeCloseTo(E * A / L, 4)
  })

  it('2D degenerate: z=0 member produces same axial stiffness as 2D formula', () => {
    // frameElement3D with member along X, Iy=Iz=I should give same in-plane stiffness as 2D
    const I = Iy
    const { ex, ey, ez } = axisFrame(1, 0, 0)
    const K3d = frameElement3D(L, E, A, I, I, G, J, ex, ey, ez)
    // Axial: K[0][0] = EA/L
    expect(K3d[0][0]).toBeCloseTo(E * A / L, 4)
    // XZ bending (strong axis, DOFs uz=2, θy=4): K[2][2] = 12EIy/L³
    expect(K3d[2][2]).toBeCloseTo(12 * E * I / (L ** 3), 4)
    // XY bending (DOFs uy=1, θz=5): K[1][1] = 12EIz/L³
    expect(K3d[1][1]).toBeCloseTo(12 * E * I / (L ** 3), 4)
  })

  it('torsion diagonal K[3][3] = GJ/L', () => {
    const { ex, ey, ez } = axisFrame(1, 0, 0)
    const K = frameElement3D(L, E, A, Iy, Iz, G, J, ex, ey, ez)
    expect(K[3][3]).toBeCloseTo(G * J / L, 4)
  })

  it('sum of each row is zero (rigid body — axial)', () => {
    // For member along X, K[0][0]+K[0][6] should be 0 (no strain under rigid translation)
    const { ex, ey, ez } = axisFrame(1, 0, 0)
    const K = frameElement3D(L, E, A, Iy, Iz, G, J, ex, ey, ez)
    // Row 0: only axial coupling, K[0][0]+K[0][6] = EA/L - EA/L = 0
    expect(K[0][0] + K[0][6]).toBeCloseTo(0, 8)
  })

  it('works for diagonal 3D member (symmetry still holds)', () => {
    const { ex, ey, ez } = axisFrame(1/Math.sqrt(3), 1/Math.sqrt(3), 1/Math.sqrt(3))
    const K = frameElement3D(L, E, A, Iy, Iz, G, J, ex, ey, ez)
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 12; j++)
        expect(K[i][j]).toBeCloseTo(K[j][i], 8)
  })
})

describe('trussElement3D', () => {
  it('returns 6×6 matrix', () => {
    const K = trussElement3D(L, E, A, 1, 0, 0)
    expect(K.length).toBe(6)
    expect(K[0].length).toBe(6)
  })

  it('is symmetric', () => {
    const K = trussElement3D(L, E, A, 1/Math.sqrt(2), 0, 1/Math.sqrt(2))
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++)
        expect(K[i][j]).toBeCloseTo(K[j][i], 8)
  })

  it('X-member: K[0][0] = EA/L, K[1][1] = 0', () => {
    const K = trussElement3D(L, E, A, 1, 0, 0)
    expect(K[0][0]).toBeCloseTo(E * A / L, 4)
    expect(K[1][1]).toBeCloseTo(0, 8)
    expect(K[2][2]).toBeCloseTo(0, 8)
  })

  it('Z-member: K[2][2] = EA/L', () => {
    const K = trussElement3D(L, E, A, 0, 0, 1)
    expect(K[2][2]).toBeCloseTo(E * A / L, 4)
    expect(K[0][0]).toBeCloseTo(0, 8)
  })

  it('degenerate to 2D: n=0 member in XY plane', () => {
    // 45° member in XY plane: l = m = 1/√2, n = 0
    const s = 1 / Math.sqrt(2)
    const K = trussElement3D(L, E, A, s, s, 0)
    const k = E * A / L
    expect(K[0][0]).toBeCloseTo(k * s * s, 4)
    expect(K[1][1]).toBeCloseTo(k * s * s, 4)
    expect(K[2][2]).toBeCloseTo(0, 8)  // no Z stiffness
  })

  it('rigid body: row 0 sums to zero for X-member', () => {
    const K = trussElement3D(L, E, A, 1, 0, 0)
    const rowSum = K[0].reduce((a, b) => a + b, 0)
    expect(rowSum).toBeCloseTo(0, 8)
  })
})
