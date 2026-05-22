/**
 * Local and global element stiffness matrices for 2D frame and truss members.
 *
 * Frame element: 6 DOF (ux1,uy1,rz1, ux2,uy2,rz2) — Euler-Bernoulli beam
 * Truss element: 4 DOF (ux1,uy1, ux2,uy2)
 *
 * Units: force in kN, length in m, so E in kN/m², I in m⁴, A in m²
 * Caller must convert property units before calling.
 */

function zeros(n: number): number[][] {
  return Array.from({ length: n }, () => new Array(n).fill(0))
}

export function frameElementStiffness(L: number, E: number, A: number, I: number, angle: number): number[][] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const EAL = E * A / L
  const EIL3 = 12 * E * I / (L * L * L)
  const EIL2 = 6 * E * I / (L * L)
  const EIL4 = 4 * E * I / L
  const EIL2_ = 2 * E * I / L

  // Local stiffness (axial + bending, 6×6)
  const kl: number[][] = zeros(6)
  kl[0][0] = EAL;  kl[0][3] = -EAL
  kl[3][0] = -EAL; kl[3][3] = EAL
  kl[1][1] = EIL3;  kl[1][2] = EIL2;  kl[1][4] = -EIL3; kl[1][5] = EIL2
  kl[2][1] = EIL2;  kl[2][2] = EIL4;  kl[2][4] = -EIL2; kl[2][5] = EIL2_
  kl[4][1] = -EIL3; kl[4][2] = -EIL2; kl[4][4] = EIL3;  kl[4][5] = -EIL2
  kl[5][1] = EIL2;  kl[5][2] = EIL2_; kl[5][4] = -EIL2; kl[5][5] = EIL4

  // Transformation matrix T (6×6)
  const T: number[][] = zeros(6)
  T[0][0] = c;  T[0][1] = s
  T[1][0] = -s; T[1][1] = c
  T[2][2] = 1
  T[3][3] = c;  T[3][4] = s
  T[4][3] = -s; T[4][4] = c
  T[5][5] = 1

  // Global stiffness: kg = Tt * kl * T
  return multiplyTtKT(T, kl)
}

export function trussElementStiffness(L: number, E: number, A: number, angle: number): number[][] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const k = E * A / L

  // 4×4 global stiffness directly
  const kg: number[][] = zeros(4)
  kg[0][0] = k * c * c;  kg[0][1] = k * c * s;  kg[0][2] = -k * c * c; kg[0][3] = -k * c * s
  kg[1][0] = k * c * s;  kg[1][1] = k * s * s;  kg[1][2] = -k * c * s; kg[1][3] = -k * s * s
  kg[2][0] = -k * c * c; kg[2][1] = -k * c * s; kg[2][2] = k * c * c;  kg[2][3] = k * c * s
  kg[3][0] = -k * c * s; kg[3][1] = -k * s * s; kg[3][2] = k * c * s;  kg[3][3] = k * s * s
  return kg
}

function multiplyTtKT(T: number[][], K: number[][]): number[][] {
  const n = T.length
  // Tt * K
  const TtK: number[][] = zeros(n)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++)
        TtK[i][j] += T[k][i] * K[k][j]
  // (Tt*K) * T
  const result: number[][] = zeros(n)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++)
        result[i][j] += TtK[i][k] * T[k][j]
  return result
}
