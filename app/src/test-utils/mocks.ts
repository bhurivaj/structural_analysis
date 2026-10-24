import type { MemberResult } from '@/types/solver'

type MRInput = Pick<MemberResult, 'memberId' | 'N' | 'V' | 'M'> & Partial<MemberResult>

/** MemberResult with 3D fields defaulted: Vy=V, Mz=M, Vz/My/T = 0. */
export function mockMemberResult(mr: MRInput): MemberResult {
  const zeros = mr.N.map(() => 0)
  return {
    stations: mr.N.map((_, i) => (mr.N.length > 1 ? i / (mr.N.length - 1) : 0)),
    endForces: [],
    Vy: mr.V,
    Mz: mr.M,
    Vz: zeros,
    My: zeros,
    T: zeros,
    ...mr,
  }
}
