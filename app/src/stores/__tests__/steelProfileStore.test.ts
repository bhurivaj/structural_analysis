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
    it('starts with empty profiles', () => {
      const store = useSteelProfileStore()
      expect(store.profiles).toEqual([])
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
      store.addProfile(makeProfile())
      expect(store.profiles.length).toBe(1)
    })

    it('deleteProfile removes the profile', () => {
      const store = useSteelProfileStore()
      store.addProfile(makeProfile({ id: 'X1' }))
      store.deleteProfile('X1')
      expect(store.profiles).toEqual([])
    })

    it('deleteProfile only removes the targeted profile', () => {
      const store = useSteelProfileStore()
      store.addProfile(makeProfile({ id: 'P1' }))
      store.addProfile(makeProfile({ id: 'P2', designation: 'H 300×300' }))
      store.deleteProfile('P1')
      expect(store.profiles.length).toBe(1)
      expect(store.profiles[0].id).toBe('P2')
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
      expect(store.filteredProfiles.length).toBe(3)
    })

    it('filters by standard', () => {
      const store = useSteelProfileStore()
      store.filterStandard = 'TIS'
      expect(store.filteredProfiles.length).toBe(2)
      store.filteredProfiles.forEach(p => expect(p.standard).toBe('TIS'))
    })

    it('filters by profile class', () => {
      const store = useSteelProfileStore()
      store.filterClass = 'H'
      expect(store.filteredProfiles.length).toBe(2)
      store.filteredProfiles.forEach(p => expect(p.profileClass).toBe('H'))
    })

    it('filters by both standard and class', () => {
      const store = useSteelProfileStore()
      store.filterStandard = 'TIS'
      store.filterClass = 'H'
      expect(store.filteredProfiles.length).toBe(1)
      expect(store.filteredProfiles[0].id).toBe('P-TIS-H')
    })

    it('filters by search query (case-insensitive)', () => {
      const store = useSteelProfileStore()
      store.searchQuery = '200'
      // 'H 200×200' and 'H 400×200' both contain '200'
      expect(store.filteredProfiles.length).toBe(2)
    })

    it('search query matches partial designation', () => {
      const store = useSteelProfileStore()
      store.searchQuery = 'I 300'
      expect(store.filteredProfiles.length).toBe(1)
      expect(store.filteredProfiles[0].id).toBe('P-TIS-I')
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
      store.addProfile(makeProfile({ id: 'H1', profileClass: 'H' }))
      store.addProfile(makeProfile({ id: 'H2', profileClass: 'H', designation: 'H 300×300' }))
      store.addProfile(makeProfile({ id: 'I1', profileClass: 'I', designation: 'I 200×100' }))
      const groups = store.groupedByClass
      expect(groups.get('H')!.length).toBe(2)
      expect(groups.get('I')!.length).toBe(1)
    })

    it('returns empty map when no profiles exist', () => {
      const store = useSteelProfileStore()
      expect(store.groupedByClass.size).toBe(0)
    })
  })
})
