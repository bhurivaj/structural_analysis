import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSteelProfileStore } from '@/stores/steelProfileStore'
import type { SteelProfile } from '@/types/steel'

function makeProfile(overrides: Partial<SteelProfile> = {}): SteelProfile {
  return {
    id: 'TEST-001',
    standard: 'TIS',
    profileClass: 'H',
    designation: 'H 200×200×8×12',
    d: 200, bf: 200, tf: 12, tw: 8, r: 13,
    A: 6353, Ix: 4.72e7, Iy: 1.60e7, Sx: 472000, Zx: 528000,
    rx: 86.2, ry: 50.2, mass: 49.9, E: 200000, Fy: 250,
    ...overrides,
  }
}

describe('steelProfileStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('starts with seed profiles loaded', () => {
      const store = useSteelProfileStore()
      expect(store.profiles.length).toBeGreaterThan(0)
    })

    it('filter defaults to ALL', () => {
      const store = useSteelProfileStore()
      expect(store.filterStandard).toBe('ALL')
      expect(store.filterClass).toBe('ALL')
    })

    it('search query defaults to empty string', () => {
      const store = useSteelProfileStore()
      expect(store.searchQuery).toBe('')
    })
  })

  describe('loadSeedData', () => {
    it('populates profiles with TIS H-section data', () => {
      const store = useSteelProfileStore()
      store.loadSeedData()
      expect(store.profiles.length).toBeGreaterThan(0)
    })

    it('seed profiles have required properties', () => {
      const store = useSteelProfileStore()
      store.loadSeedData()
      const p = store.profiles[0]
      expect(p.id).toBeTruthy()
      expect(p.standard).toBeTruthy()
      expect(p.designation).toBeTruthy()
      expect(p.E).toBeGreaterThan(0)
    })

    it('all seed profiles are standard TIS', () => {
      const store = useSteelProfileStore()
      store.loadSeedData()
      store.profiles.forEach(p => expect(p.standard).toBe('TIS'))
    })
  })

  describe('addProfile / deleteProfile', () => {
    it('addProfile appends a profile', () => {
      const store = useSteelProfileStore()
      const before = store.profiles.length
      store.addProfile(makeProfile())
      expect(store.profiles.length).toBe(before + 1)
    })

    it('deleteProfile removes the profile', () => {
      const store = useSteelProfileStore()
      store.addProfile(makeProfile({ id: 'X1' }))
      expect(store.profileById('X1')).toBeDefined()
      store.deleteProfile('X1')
      expect(store.profileById('X1')).toBeUndefined()
    })

    it('deleteProfile only removes the targeted profile', () => {
      const store = useSteelProfileStore()
      const before = store.profiles.length
      store.addProfile(makeProfile({ id: 'P1' }))
      store.addProfile(makeProfile({ id: 'P2', designation: 'H 300×300×14×14' }))
      store.deleteProfile('P1')
      expect(store.profiles.length).toBe(before + 1)
      expect(store.profileById('P2')).toBeDefined()
      expect(store.profileById('P1')).toBeUndefined()
    })
  })

  describe('profileById computed', () => {
    it('returns correct profile by id', () => {
      const store = useSteelProfileStore()
      store.addProfile(makeProfile({ id: 'FIND-ME' }))
      expect(store.profileById('FIND-ME')).toBeDefined()
      expect(store.profileById('FIND-ME')!.id).toBe('FIND-ME')
    })

    it('returns undefined for unknown id', () => {
      const store = useSteelProfileStore()
      expect(store.profileById('ghost')).toBeUndefined()
    })
  })

  describe('filteredProfiles computed', () => {
    beforeEach(() => {
      const store = useSteelProfileStore()
      store.addProfile(makeProfile({ id: 'P-TIS-H', standard: 'TIS', profileClass: 'H', designation: 'H 200×200' }))
      store.addProfile(makeProfile({ id: 'P-TIS-I', standard: 'TIS', profileClass: 'I', designation: 'I 300×150' }))
      store.addProfile(makeProfile({ id: 'P-JIS-H', standard: 'JIS', profileClass: 'H', designation: 'H 400×200' }))
    })

    it('shows all profiles when filters are ALL', () => {
      const store = useSteelProfileStore()
      // 3 test profiles + seed data
      expect(store.filteredProfiles.length).toBeGreaterThan(3)
      expect(store.profileById('P-TIS-H')).toBeDefined()
      expect(store.profileById('P-JIS-H')).toBeDefined()
    })

    it('filters by standard', () => {
      const store = useSteelProfileStore()
      // Only P-JIS-H is JIS — all seed data is TIS
      store.filterStandard = 'JIS'
      expect(store.filteredProfiles.length).toBe(1)
      expect(store.filteredProfiles[0].id).toBe('P-JIS-H')
    })

    it('filters by profile class', () => {
      const store = useSteelProfileStore()
      store.filterClass = 'H'
      store.filteredProfiles.forEach(p => expect(p.profileClass).toBe('H'))
      expect(store.filteredProfiles.some(p => p.id === 'P-TIS-H')).toBe(true)
      expect(store.filteredProfiles.some(p => p.id === 'P-JIS-H')).toBe(true)
      expect(store.filteredProfiles.some(p => p.id === 'P-TIS-I')).toBe(false)
    })

    it('filters by both standard and class', () => {
      const store = useSteelProfileStore()
      // JIS+H isolates to exactly P-JIS-H
      store.filterStandard = 'JIS'
      store.filterClass = 'H'
      expect(store.filteredProfiles.length).toBe(1)
      expect(store.filteredProfiles[0].id).toBe('P-JIS-H')
    })

    it('filters by search query (case-insensitive)', () => {
      const store = useSteelProfileStore()
      // Use a unique designation that won't appear in seed data
      store.addProfile(makeProfile({ id: 'UNIQ', designation: 'H ZZZTEST-UNIQUE-999' }))
      store.searchQuery = 'ZZZTEST-UNIQUE-999'
      expect(store.filteredProfiles.length).toBe(1)
      expect(store.filteredProfiles[0].id).toBe('UNIQ')
    })

    it('search query matches partial designation', () => {
      const store = useSteelProfileStore()
      // Use unique JIS profile so seed data doesn't interfere
      store.filterStandard = 'JIS'
      store.searchQuery = 'H 400'
      expect(store.filteredProfiles.length).toBe(1)
      expect(store.filteredProfiles[0].id).toBe('P-JIS-H')
    })

    it('search is case-insensitive', () => {
      const store = useSteelProfileStore()
      store.searchQuery = 'h 200'
      expect(store.filteredProfiles.length).toBeGreaterThan(0)
    })

    it('returns empty array when no profiles match', () => {
      const store = useSteelProfileStore()
      store.searchQuery = 'ZZZZNOTSUCH'
      expect(store.filteredProfiles).toEqual([])
    })
  })

  describe('groupedByClass computed', () => {
    it('groups profiles by profileClass', () => {
      const store = useSteelProfileStore()
      // Isolate to JIS to get only test-added profiles
      store.addProfile(makeProfile({ id: 'JIS-H1', standard: 'JIS', profileClass: 'H' }))
      store.addProfile(makeProfile({ id: 'JIS-H2', standard: 'JIS', profileClass: 'H', designation: 'H 300×300' }))
      store.addProfile(makeProfile({ id: 'JIS-I1', standard: 'JIS', profileClass: 'I', designation: 'I 200×100' }))
      store.filterStandard = 'JIS'
      const groups = store.groupedByClass
      expect(groups.get('H')!.length).toBe(2)
      expect(groups.get('I')!.length).toBe(1)
    })

    it('returns non-empty map from seed data', () => {
      const store = useSteelProfileStore()
      expect(store.groupedByClass.size).toBeGreaterThan(0)
    })
  })
})
