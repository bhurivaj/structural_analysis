<script setup lang="ts">
import { useSteelProfileStore } from '@/stores/steelProfileStore'
import type { ProfileStandard, ProfileClass } from '@/types/steel'

const store = useSteelProfileStore()

const standards: Array<ProfileStandard | 'ALL'> = ['ALL', 'TIS', 'JIS', 'ASTM', 'EN']
const classes: Array<ProfileClass | 'ALL'> = ['ALL', 'H', 'I', 'C', 'L', 'RHS', 'CHS', 'RoundPipe', 'WideFlange', 'LightLipChannel']
</script>

<template>
  <div class="p-3 space-y-3">
    <input
      v-model="store.searchQuery"
      type="text"
      placeholder="Search designation..."
      class="w-full px-2 py-1 text-sm border border-slate-300 rounded"
    />

    <div>
      <div class="text-xs text-slate-500 mb-1">Standard</div>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="std in standards"
          :key="std"
          class="px-2 py-0.5 text-xs rounded border transition-colors"
          :class="store.filterStandard === std ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'"
          @click="store.filterStandard = std"
        >{{ std }}</button>
      </div>
    </div>

    <div>
      <div class="text-xs text-slate-500 mb-1">Section Type</div>
      <div class="flex flex-wrap gap-1">
        <button
          v-for="cls in classes"
          :key="cls"
          class="px-2 py-0.5 text-xs rounded border transition-colors"
          :class="store.filterClass === cls ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:border-blue-400'"
          @click="store.filterClass = cls"
        >{{ cls }}</button>
      </div>
    </div>
  </div>
</template>
