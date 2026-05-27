import type { StructureNode } from '@/types/structure'

/** Member length in 3D (m). Treats missing z as 0. */
export function memberLength3D(n1: StructureNode, n2: StructureNode): number {
  const dx = n2.x - n1.x
  const dy = n2.y - n1.y
  const dz = (n2.z ?? 0) - (n1.z ?? 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Unit direction vector along member axis in global frame. */
export function memberDirectionCosines(
  n1: StructureNode,
  n2: StructureNode,
): { L: number; l: number; m: number; n: number } {
  const dx = n2.x - n1.x
  const dy = n2.y - n1.y
  const dz = (n2.z ?? 0) - (n1.z ?? 0)
  const L = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (L < 1e-12) throw new Error('Zero-length member detected')
  return { L, l: dx / L, m: dy / L, n: dz / L }
}

/**
 * Compute local axis frame (ex, ey, ez) for a 3D beam element.
 *
 * Convention (Y is global vertical):
 *   ex = member axis (l, m, n)
 *   Non-vertical members (|m| < 0.99):
 *     ey = normalize(globalY − (globalY·ex)·ex)  — perpendicular to member in the vertical plane
 *          = normalize(−ml, 1−m², −mn)           ≈ global Y for horizontal members
 *     ez = cross(ex, ey)                          — horizontal-transverse (out of plane)
 *   Vertical members (|m| ≥ 0.99):
 *     ey = (1, 0, 0)  (global X)
 *     ez = cross(ex, ey)
 *
 * Result:
 *   ey (local y) is the "gravity / in-plane" bending axis.
 *     XY bending (Vy, Mz) uses Iz (I about local z).
 *   ez (local z) is the "lateral / out-of-plane" bending axis.
 *     XZ bending (Vz, My) uses Iy (I about local y).
 *
 * This matches the old 2D local-y convention so that V = Vy and M = Mz are
 * correct backward-compat aliases for 2D structures loaded in the XY plane.
 */
export function localAxisFrame(
  l: number,
  m: number,
  n: number,
): { ex: number[]; ey: number[]; ez: number[] } {
  const ex = [l, m, n]

  let ey: number[]
  let ez: number[]

  if (Math.abs(m) < 0.99) {
    // Gram-Schmidt: component of globalY perpendicular to ex
    // globalY − (globalY·ex)·ex = (−ml, 1−m², −mn), length = √(1−m²)
    const len = Math.sqrt(1 - m * m)
    ey = len > 1e-12
      ? [-m * l / len, (1 - m * m) / len, -m * n / len]
      : [0, 1, 0]
    ez = cross3(ex, ey)
  } else {
    // Vertical member: use global X as reference for ey
    ey = [1, 0, 0]
    ez = cross3(ex, ey)
    normalise(ez)
  }

  return { ex, ey, ez }
}

/**
 * 12×12 transformation matrix: T = block_diag(Rᵀ, Rᵀ, Rᵀ, Rᵀ)
 * where R = [ex | ey | ez] (local axes as columns in global frame).
 * d_local = T × d_global
 */
export function transformationMatrix12x12(
  ex: number[],
  ey: number[],
  ez: number[],
): number[][] {
  // Rᵀ maps global → local
  const RT = [
    [ex[0], ex[1], ex[2]],
    [ey[0], ey[1], ey[2]],
    [ez[0], ez[1], ez[2]],
  ]

  const T: number[][] = Array.from({ length: 12 }, () => new Array(12).fill(0))
  for (let block = 0; block < 4; block++) {
    const off = block * 3
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        T[off + i][off + j] = RT[i][j]
  }
  return T
}

function cross3(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function normalise(v: number[]): void {
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
  if (len > 1e-12) { v[0] /= len; v[1] /= len; v[2] /= len }
}
