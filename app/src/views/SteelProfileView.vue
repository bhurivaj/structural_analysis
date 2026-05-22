<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ProfileFilters from '@/components/steel/ProfileFilters.vue'
import ProfileTable from '@/components/steel/ProfileTable.vue'
import ProfileDetailCard from '@/components/steel/ProfileDetailCard.vue'
import { useSteelProfileStore } from '@/stores/steelProfileStore'
import type { SteelProfile } from '@/types/steel'

const store = useSteelProfileStore()
const selectedProfile = ref<SteelProfile | null>(null)

onMounted(() => {
  if (store.profiles.length === 0) store.loadSeedData()
})
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- Left filters -->
    <div class="w-52 border-r border-slate-200 bg-slate-50 overflow-y-auto shrink-0">
      <ProfileFilters />
    </div>

    <!-- Center table -->
    <div class="flex-1 overflow-hidden">
      <ProfileTable @select="p => selectedProfile = p" />
    </div>

    <!-- Right detail -->
    <div class="w-56 border-l border-slate-200 bg-white overflow-y-auto shrink-0">
      <ProfileDetailCard :profile="selectedProfile" />
    </div>
  </div>
</template>
