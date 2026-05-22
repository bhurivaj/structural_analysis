<script setup lang="ts">
import { ref } from 'vue'
import { useSteelProfileStore } from '@/stores/steelProfileStore'
import type { SteelProfile } from '@/types/steel'

const store = useSteelProfileStore()
const emit = defineEmits<{ (e: 'select', profile: SteelProfile): void }>()

const sortKey = ref<keyof SteelProfile>('designation')
const sortAsc = ref(true)

function toggleSort(key: keyof SteelProfile) {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value
  else { sortKey.value = key; sortAsc.value = true }
}
</script>

<template>
  <div class="overflow-auto h-full">
    <table class="w-full text-xs border-collapse">
      <thead class="bg-slate-100 sticky top-0">
        <tr>
          <th
            v-for="col in [['designation','Designation'],['standard','Std'],['profileClass','Type'],['A','A (mm²)'],['Ix','Ix (mm⁴)'],['mass','kg/m']]"
            :key="col[0]"
            class="px-2 py-1.5 text-left font-medium text-slate-600 cursor-pointer hover:bg-slate-200 whitespace-nowrap"
            @click="toggleSort(col[0] as keyof SteelProfile)"
          >
            {{ col[1] }}
            <span v-if="sortKey === col[0]">{{ sortAsc ? '↑' : '↓' }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="p in store.filteredProfiles"
          :key="p.id"
          class="border-b border-slate-100 hover:bg-blue-50 cursor-pointer"
          @click="emit('select', p)"
        >
          <td class="px-2 py-1">{{ p.designation }}</td>
          <td class="px-2 py-1">{{ p.standard }}</td>
          <td class="px-2 py-1">{{ p.profileClass }}</td>
          <td class="px-2 py-1">{{ p.A.toLocaleString() }}</td>
          <td class="px-2 py-1">{{ (p.Ix / 1e6).toFixed(2) }}×10⁶</td>
          <td class="px-2 py-1">{{ p.mass }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="store.filteredProfiles.length === 0" class="p-4 text-center text-slate-400 text-sm">
      No profiles found.
    </div>
  </div>
</template>
