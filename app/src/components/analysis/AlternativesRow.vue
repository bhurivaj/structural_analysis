<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MemberResult } from '@/types/solver'
import type { Member, StructureNode } from '@/types/structure'
import type { SteelProfile } from '@/types/steel'
import { getAlternatives } from '@/utils/autoSize'
import CapacityGraph from './CapacityGraph.vue'

const props = defineProps<{
  memberResult: MemberResult
  member: Member
  nodes: Map<string, StructureNode>
  profiles: SteelProfile[]
  defaultFy: number
  urMarginal: number
  urFail: number
  currentProfileClass: string | undefined
}>()

const emit = defineEmits<{
  apply: [profileId: string]
}>()

const activeTab = ref<'table' | 'graph'>('table')

const alternatives = computed(() =>
  getAlternatives(
    props.memberResult,
    props.member,
    props.nodes,
    props.profiles,
    props.defaultFy,
    props.urMarginal,
    props.urFail,
    props.currentProfileClass,
  ),
)

function statusColor(status: string): string {
  if (status === 'PASS') return 'text-emerald-600'
  if (status === 'MARGINAL') return 'text-amber-500'
  return 'text-red-500'
}
</script>

<template>
  <div class="bg-slate-50 border-t border-slate-200 px-3 py-2">
    <div class="flex items-center justify-between mb-1.5">
      <div class="text-xs font-medium text-slate-600">
        Alternative Profiles
        <span v-if="currentProfileClass" class="text-slate-400">({{ currentProfileClass }} class, sorted by mass)</span>
      </div>
      <div class="flex rounded border border-slate-200 overflow-hidden text-[10px]">
        <button
          class="px-2 py-0.5 transition-colors"
          :class="activeTab === 'table' ? 'bg-slate-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'"
          @click="activeTab = 'table'"
        >Table</button>
        <button
          class="px-2 py-0.5 transition-colors"
          :class="activeTab === 'graph' ? 'bg-slate-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'"
          @click="activeTab = 'graph'"
        >Graph</button>
      </div>
    </div>

    <CapacityGraph
      v-if="activeTab === 'graph'"
      :alternatives="alternatives"
      :current-profile-id="member.steelProfileId ?? null"
      :ur-marginal="urMarginal"
      :ur-fail="urFail"
    />

    <div v-else-if="alternatives.length === 0" class="text-xs text-slate-400">No alternatives found.</div>
    <table v-else class="w-full text-xs border-collapse">
      <thead>
        <tr class="text-slate-500">
          <th class="text-left px-1 py-0.5">Designation</th>
          <th class="text-right px-1 py-0.5">kg/m</th>
          <th class="text-right px-1 py-0.5">UR_axial</th>
          <th class="text-right px-1 py-0.5">UR_bending</th>
          <th class="text-right px-1 py-0.5">UR_shear</th>
          <th class="text-right px-1 py-0.5">UR_combined</th>
          <th class="text-center px-1 py-0.5">Status</th>
          <th class="px-1 py-0.5"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="alt in alternatives"
          :key="alt.profile.id"
          class="border-t border-slate-100 hover:bg-white"
        >
          <td class="px-1 py-0.5 font-mono font-medium">{{ alt.profile.designation }}</td>
          <td class="px-1 py-0.5 text-right text-slate-600">{{ alt.profile.mass }}</td>
          <td class="px-1 py-0.5 text-right font-mono" :class="alt.urValues.UR_axial > 1 ? 'text-red-500' : 'text-emerald-600'">
            {{ alt.urValues.UR_axial.toFixed(3) }}
          </td>
          <td class="px-1 py-0.5 text-right font-mono" :class="alt.urValues.UR_bending > 1 ? 'text-red-500' : 'text-emerald-600'">
            {{ alt.urValues.UR_bending.toFixed(3) }}
          </td>
          <td class="px-1 py-0.5 text-right font-mono" :class="alt.urValues.UR_shear > 1 ? 'text-red-500' : 'text-emerald-600'">
            {{ alt.urValues.UR_shear.toFixed(3) }}
          </td>
          <td class="px-1 py-0.5 text-right font-mono font-medium" :class="statusColor(alt.urValues.status)">
            {{ alt.urValues.UR_combined.toFixed(3) }}
          </td>
          <td class="px-1 py-0.5 text-center font-bold text-xs" :class="statusColor(alt.urValues.status)">
            {{ alt.urValues.status }}
          </td>
          <td class="px-1 py-0.5">
            <button
              class="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              @click="emit('apply', alt.profile.id)"
            >
              Apply
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
