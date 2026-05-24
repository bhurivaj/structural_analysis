import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/settingsStore'

describe('settingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ── default state ─────────────────────────────────────────────────────────────
  describe('default state', () => {
    it('uses kN, m, MPa as default units', () => {
      const store = useSettingsStore()
      expect(store.forceUnit).toBe('kN')
      expect(store.lengthUnit).toBe('m')
      expect(store.stressUnit).toBe('MPa')
    })
  })

  // ── toForce ───────────────────────────────────────────────────────────────────
  describe('toForce', () => {
    it('kN → kN: identity', () => {
      const s = useSettingsStore()
      expect(s.toForce(10)).toBe(10)
    })

    it('kN → N: multiplies by 1000', () => {
      const s = useSettingsStore()
      s.forceUnit = 'N'
      expect(s.toForce(1)).toBe(1000)
      expect(s.toForce(5)).toBe(5000)
    })

    it('kN → tf: divides by 9.80665', () => {
      const s = useSettingsStore()
      s.forceUnit = 'tf'
      expect(s.toForce(9.80665)).toBeCloseTo(1, 4)
      expect(s.toForce(0)).toBe(0)
    })
  })

  // ── toLength ──────────────────────────────────────────────────────────────────
  describe('toLength', () => {
    it('m → m: identity', () => {
      const s = useSettingsStore()
      expect(s.toLength(3)).toBe(3)
    })

    it('m → cm: multiplies by 100', () => {
      const s = useSettingsStore()
      s.lengthUnit = 'cm'
      expect(s.toLength(1)).toBe(100)
      expect(s.toLength(2.5)).toBe(250)
    })

    it('m → mm: multiplies by 1000', () => {
      const s = useSettingsStore()
      s.lengthUnit = 'mm'
      expect(s.toLength(1)).toBe(1000)
    })

    it('m → ft: multiplies by 3.28084', () => {
      const s = useSettingsStore()
      s.lengthUnit = 'ft'
      expect(s.toLength(1)).toBeCloseTo(3.28084, 4)
    })
  })

  // ── toStress ──────────────────────────────────────────────────────────────────
  describe('toStress', () => {
    it('MPa → MPa: identity', () => {
      const s = useSettingsStore()
      expect(s.toStress(250)).toBe(250)
    })

    it('MPa → kPa: multiplies by 1000', () => {
      const s = useSettingsStore()
      s.stressUnit = 'kPa'
      expect(s.toStress(1)).toBe(1000)
    })

    it('MPa → tf/cm²: divides by 98.0665', () => {
      const s = useSettingsStore()
      s.stressUnit = 'tf/cm²'
      expect(s.toStress(98.0665)).toBeCloseTo(1, 4)
    })

    it('MPa → ksc: multiplies by 10.197', () => {
      const s = useSettingsStore()
      s.stressUnit = 'ksc'
      expect(s.toStress(1)).toBeCloseTo(10.197, 3)
    })
  })

  // ── fromForce ─────────────────────────────────────────────────────────────────
  describe('fromForce', () => {
    it('N: inverse of toForce', () => {
      const s = useSettingsStore()
      s.forceUnit = 'N'
      expect(s.fromForce(s.toForce(7))).toBeCloseTo(7, 6)
    })

    it('tf: inverse of toForce', () => {
      const s = useSettingsStore()
      s.forceUnit = 'tf'
      expect(s.fromForce(s.toForce(5))).toBeCloseTo(5, 4)
    })

    it('kN: identity', () => {
      const s = useSettingsStore()
      expect(s.fromForce(10)).toBe(10)
    })
  })

  // ── fromLength ────────────────────────────────────────────────────────────────
  describe('fromLength', () => {
    it('cm: inverse of toLength', () => {
      const s = useSettingsStore()
      s.lengthUnit = 'cm'
      expect(s.fromLength(s.toLength(3))).toBeCloseTo(3, 6)
    })

    it('mm: inverse of toLength', () => {
      const s = useSettingsStore()
      s.lengthUnit = 'mm'
      expect(s.fromLength(s.toLength(2))).toBeCloseTo(2, 6)
    })

    it('ft: inverse of toLength', () => {
      const s = useSettingsStore()
      s.lengthUnit = 'ft'
      expect(s.fromLength(s.toLength(1))).toBeCloseTo(1, 4)
    })

    it('m: identity', () => {
      const s = useSettingsStore()
      expect(s.fromLength(5)).toBe(5)
    })
  })

  // ── toMoment ──────────────────────────────────────────────────────────────────
  describe('toMoment', () => {
    it('1 kN·m stays 1 in default units', () => {
      const s = useSettingsStore()
      expect(s.toMoment(1)).toBe(1)
    })

    it('scales with both force and length unit', () => {
      const s = useSettingsStore()
      s.forceUnit = 'N'
      s.lengthUnit = 'cm'
      // 1 kN·m = 1000 N × 100 cm = 100 000 N·cm
      expect(s.toMoment(1)).toBe(100000)
    })
  })

  // ── computed labels ───────────────────────────────────────────────────────────
  describe('momentLabel', () => {
    it('reflects current force + length units', () => {
      const s = useSettingsStore()
      expect(s.momentLabel).toBe('kN·m')
      s.forceUnit = 'N'
      s.lengthUnit = 'cm'
      expect(s.momentLabel).toBe('N·cm')
    })
  })

  describe('distForceLabel', () => {
    it('reflects force/length', () => {
      const s = useSettingsStore()
      expect(s.distForceLabel).toBe('kN/m')
    })
  })

  describe('unitDisplay', () => {
    it('shows all three units', () => {
      const s = useSettingsStore()
      expect(s.unitDisplay).toBe('kN, m, MPa')
    })
  })

  // ── save / load ───────────────────────────────────────────────────────────────
  describe('save / load', () => {
    it('round-trips all settings through localStorage', () => {
      const s = useSettingsStore()
      s.projectName = 'Bridge A'
      s.engineerName = 'Alice'
      s.forceUnit = 'N'
      s.lengthUnit = 'cm'
      s.stressUnit = 'kPa'
      s.defaultE = 180000
      s.defaultFy = 345
      s.urMarginal = 0.75
      s.urFail = 0.9
      s.save()

      setActivePinia(createPinia())
      const s2 = useSettingsStore()
      s2.load()

      expect(s2.projectName).toBe('Bridge A')
      expect(s2.engineerName).toBe('Alice')
      expect(s2.forceUnit).toBe('N')
      expect(s2.lengthUnit).toBe('cm')
      expect(s2.stressUnit).toBe('kPa')
      expect(s2.defaultE).toBe(180000)
      expect(s2.defaultFy).toBe(345)
      expect(s2.urMarginal).toBe(0.75)
      expect(s2.urFail).toBe(0.9)
    })

    it('load() is a no-op when localStorage is empty', () => {
      const s = useSettingsStore()
      s.load()
      expect(s.forceUnit).toBe('kN')
    })

    it('load() silently ignores malformed JSON', () => {
      localStorage.setItem('structcalc_settings', 'not-json{{{')
      const s = useSettingsStore()
      expect(() => s.load()).not.toThrow()
      expect(s.forceUnit).toBe('kN')
    })

    it('partial data: only updates fields that are present', () => {
      localStorage.setItem('structcalc_settings', JSON.stringify({ forceUnit: 'tf' }))
      const s = useSettingsStore()
      s.load()
      expect(s.forceUnit).toBe('tf')
      expect(s.lengthUnit).toBe('m') // untouched
    })
  })
})
