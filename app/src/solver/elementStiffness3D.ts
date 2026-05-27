import { transformationMatrix12x12 } from './geometry3D'

/**
 * 3D Euler-Bernoulli beam element — 12×12 global stiffness matrix.
 *
 * Local DOF order: [ux1, uy1, uz1, θx1, θy1, θz1, ux2, uy2, uz2, θx2, θy2, θz2]
 *
 * Section moments of inertia (in local frame):
 *   Iy = I about local y-axis → resists bending in XZ plane (gravity, strong axis)
 *   Iz = I about local z-axis → resists bending in XY plane (lateral, weak axis)
 *   J  = St-Venant torsion constant
 *
 * Units: E in kN/m², A in m², Iy/Iz/J in m⁴, G in kN/m², L in m.
 */
export function frameElement3D(
  L: number,
  E: number,
  A: number,
  Iy: number,
  Iz: number,
  G: number,
  J: number,
  ex: number[],
  ey: number[],
  ez: number[],
): number[][] {
  const n = 12
  const kl: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  const EAL = E * A / L
  const GJL = G * J / L

  // --- Axial (DOFs 0, 6) ---
  kl[0][0] = EAL;  kl[0][6] = -EAL
  kl[6][0] = -EAL; kl[6][6] = EAL

  // --- Torsion (DOFs 3, 9) ---
  kl[3][3] = GJL;  kl[3][9] = -GJL
  kl[9][3] = -GJL; kl[9][9] = GJL

  // --- XZ bending — uses Iy (DOFs: uz=2, θy=4, uz=8, θy=10) ---
  // Sign convention: θy = -duz/dx, causing sign flips on θy coupling terms
  const a3 = 12 * E * Iy / (L * L * L)
  const b2 = 6 * E * Iy / (L * L)
  const c4 = 4 * E * Iy / L
  const d2 = 2 * E * Iy / L

  kl[2][2] =  a3;  kl[2][4] = -b2;  kl[2][8] = -a3;  kl[2][10] = -b2
  kl[4][2] = -b2;  kl[4][4] =  c4;  kl[4][8] =  b2;  kl[4][10] =  d2
  kl[8][2] = -a3;  kl[8][4] =  b2;  kl[8][8] =  a3;  kl[8][10] =  b2
  kl[10][2] = -b2; kl[10][4] =  d2; kl[10][8] =  b2; kl[10][10] = c4

  // --- XY bending — uses Iz (DOFs: uy=1, θz=5, uy=7, θz=11) ---
  const e3 = 12 * E * Iz / (L * L * L)
  const f2 = 6 * E * Iz / (L * L)
  const g4 = 4 * E * Iz / L
  const h2 = 2 * E * Iz / L

  kl[1][1] =  e3;  kl[1][5] =  f2;  kl[1][7] = -e3;  kl[1][11] =  f2
  kl[5][1] =  f2;  kl[5][5] =  g4;  kl[5][7] = -f2;  kl[5][11] =  h2
  kl[7][1] = -e3;  kl[7][5] = -f2;  kl[7][7] =  e3;  kl[7][11] = -f2
  kl[11][1] =  f2; kl[11][5] =  h2; kl[11][7] = -f2; kl[11][11] = g4

  // Global stiffness: Kg = Tᵀ · Kl · T
  const T = transformationMatrix12x12(ex, ey, ez)
  return multiplyTtKT(T, kl)
}

/**
 * 3D truss element — 6×6 global stiffness matrix (direct formulation).
 * l, m, n are direction cosines along member axis.
 */
export function trussElement3D(
  L: number,
  E: number,
  A: number,
  l: number,
  m: number,
  n: number,
): number[][] {
  const k = E * A / L
  const kg: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0))
  const dc = [l, m, n]
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const v = k * dc[i] * dc[j]
      kg[i][j] = v;     kg[i][j + 3] = -v
      kg[i + 3][j] = -v; kg[i + 3][j + 3] = v
    }
  }
  return kg
}

function multiplyTtKT(T: number[][], K: number[][]): number[][] {
  const n = T.length
  // Tᵀ · K
  const TtK: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let p = 0; p < n; p++)
        TtK[i][j] += T[p][i] * K[p][j]
  // (Tᵀ·K) · T
  const result: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let p = 0; p < n; p++)
        result[i][j] += TtK[i][p] * T[p][j]
  return result
}
