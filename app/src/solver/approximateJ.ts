import type { SteelProfile } from '@/types/steel'

/**
 * Approximate St-Venant torsion constant J (mm⁴) from section geometry.
 *
 * CHS/RoundPipe: exact thin-wall formula J = π(d₀⁴ - dᵢ⁴)/32
 * RHS: thin-wall closed section J ≈ 2t·Am²/perimeter
 * Open sections (H, I, C, L, WideFlange, LightLipChannel): J ≈ (1/3)·Σbᵢtᵢ³
 */
export function approximateJ(profile: SteelProfile): number {
  const { d, bf, tf, tw, profileClass } = profile

  switch (profileClass) {
    case 'CHS':
    case 'RoundPipe': {
      const t = tf
      const di = d - 2 * t
      return (Math.PI / 32) * (d ** 4 - di ** 4)
    }

    case 'RHS': {
      // Thin-wall closed box: J = 2·t·(Am)²/perimeter, uniform thickness t = tf
      const t = tf
      const h_mid = d - t
      const b_mid = bf - t
      const Am = h_mid * b_mid
      const perim = 2 * (h_mid + b_mid)
      return (2 * t * Am * Am) / perim
    }

    case 'H':
    case 'I':
    case 'WideFlange':
    case 'C':
    case 'LightLipChannel': {
      // Open section: J ≈ (1/3)·[2·bf·tf³ + (d-2tf)·tw³]
      const webHeight = d - 2 * tf
      return (1 / 3) * (2 * bf * tf ** 3 + webHeight * tw ** 3)
    }

    case 'L': {
      // Equal/unequal angle: J ≈ (1/3)·[bf·tf³ + (d-tf)·tw³]
      return (1 / 3) * (bf * tf ** 3 + (d - tf) * tw ** 3)
    }

    default:
      return 0
  }
}
