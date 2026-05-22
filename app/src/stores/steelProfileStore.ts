import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SteelProfile, ProfileStandard, ProfileClass } from '@/types/steel'
import { tis_h, tis_i, tis_c, tis_l, tis_rhs, tis_chs, tis_rp, tis_wf, tis_llc } from '@/data/steelProfiles'

export const useSteelProfileStore = defineStore('steelProfile', () => {
  const profiles = ref<SteelProfile[]>([])
  const filterStandard = ref<ProfileStandard | 'ALL'>('ALL')
  const filterClass = ref<ProfileClass | 'ALL'>('ALL')
  const searchQuery = ref('')

  const filteredProfiles = computed(() => {
    return profiles.value.filter(p => {
      if (filterStandard.value !== 'ALL' && p.standard !== filterStandard.value) return false
      if (filterClass.value !== 'ALL' && p.profileClass !== filterClass.value) return false
      if (searchQuery.value && !p.designation.toLowerCase().includes(searchQuery.value.toLowerCase())) return false
      return true
    })
  })

  const profileById = computed(() => (id: string) => profiles.value.find(p => p.id === id))

  const groupedByClass = computed(() => {
    const groups = new Map<ProfileClass, SteelProfile[]>()
    for (const p of filteredProfiles.value) {
      const arr = groups.get(p.profileClass) ?? []
      arr.push(p)
      groups.set(p.profileClass, arr)
    }
    return groups
  })

  function loadSeedData() {
    profiles.value = [...tis_h, ...tis_i, ...tis_c, ...tis_l, ...tis_rhs, ...tis_chs, ...tis_rp, ...tis_wf, ...tis_llc]
  }

  function addProfile(profile: SteelProfile) {
    profiles.value.push(profile)
  }

  function deleteProfile(id: string) {
    profiles.value = profiles.value.filter(p => p.id !== id)
  }

  return {
    profiles,
    filterStandard,
    filterClass,
    searchQuery,
    filteredProfiles,
    profileById,
    groupedByClass,
    loadSeedData,
    addProfile,
    deleteProfile,
  }
})
