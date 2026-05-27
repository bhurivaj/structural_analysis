import type { SteelProfile } from '@/types/steel'
import { approximateJ } from '@/solver/approximateJ'

/**
 * Derive all Member section properties from a SteelProfile.
 * Centralises the mapping so every profile-assignment site stays consistent.
 *
 * Local axis convention: ey ≈ global Y (gravity) for horizontal members.
 * XY bending (Vy, Mz) uses Iz → strong axis = profile.Ix.
 * XZ bending (Vz, My) uses Iy → weak axis   = profile.Iy.
 * J  = torsion constant, approximated from section geometry.
 */
export function memberPropsFromProfile(profile: SteelProfile) {
  return {
    steelProfileId: profile.id,
    E: profile.E,
    A: profile.A,
    I: profile.Ix,
    Iz: profile.Ix,  // strong axis → gravity / XY bending
    Iy: profile.Iy,  // weak axis   → lateral / XZ bending
    J: approximateJ(profile),
  }
}
