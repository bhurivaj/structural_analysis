<script setup lang="ts">
import { useLoadsStore } from '@/stores/loadsStore'
import { useStructureStore } from '@/stores/structureStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useLoadCasesStore } from '@/stores/loadCasesStore'
import type { PointLoad, DistributedLoad, MomentLoad } from '@/types/loads'
import type { LoadCaseCategory } from '@/types/loadCases'

const loads = useLoadsStore()
const structure = useStructureStore()
const settings = useSettingsStore()
const loadCases = useLoadCasesStore()

const CASE_COLORS: Record<LoadCaseCategory, string> = {
  D: 'bg-slate-200 text-slate-700',
  L: 'bg-blue-100 text-blue-700',
  W: 'bg-sky-100 text-sky-700',
  E: 'bg-red-100 text-red-700',
  S: 'bg-violet-100 text-violet-700',
}
const CASE_NAMES: Record<LoadCaseCategory, string> = { D: 'Dead', L: 'Live', W: 'Wind', E: 'Seismic', S: 'Snow' }

function nodeName(id: string) {
  return structure.nodeById(id)?.label || id.slice(0, 6)
}

function memberName(id: string) {
  const m = structure.memberById(id)
  return m?.label || id.slice(0, 6)
}
</script>

<template>
  <!-- Load Combinations -->
  <section class="border-t border-slate-200 pt-4">
    <h2 class="font-semibold text-slate-700 mb-2">6. Load Combinations</h2>
    <table class="text-xs border-collapse w-full">
      <thead class="bg-slate-100">
        <tr>
          <th class="px-2 py-1 text-left">Combination</th>
          <th class="px-2 py-1 text-left">Factors</th>
          <th class="px-2 py-1 text-center">Active</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="combo in loadCases.combinations" :key="combo.id" class="border-b border-slate-100"
          :class="loadCases.activeCombinationId === combo.id ? 'bg-blue-50' : ''">
          <td class="px-2 py-1 font-medium">{{ combo.name }}</td>
          <td class="px-2 py-1">
            <span v-for="(f, i) in combo.factors" :key="i" class="inline-flex items-center mr-1">
              <span class="px-1 rounded text-[10px] font-bold mr-0.5" :class="CASE_COLORS[f.case]">{{ f.case }}</span>
              <span class="font-mono text-[10px]">×{{ f.factor }}</span>
            </span>
          </td>
          <td class="px-2 py-1 text-center">{{ loadCases.activeCombinationId === combo.id ? '✓' : '' }}</td>
        </tr>
      </tbody>
    </table>
  </section>

  <!-- Applied Loads -->
  <section class="border-t border-slate-200 pt-4">
    <h2 class="font-semibold text-slate-700 mb-2">7. Applied Loads</h2>
    <table class="w-full text-xs border-collapse">
      <thead class="bg-slate-100">
        <tr>
          <th class="px-2 py-1 text-left">Label</th>
          <th class="px-2 py-1 text-left">Case</th>
          <th class="px-2 py-1 text-left">Type</th>
          <th class="px-2 py-1 text-left">Location</th>
          <th class="px-2 py-1 text-right">Values</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="l in loads.loads" :key="l.id" class="border-b border-slate-100">
          <td class="px-2 py-1 font-medium">{{ (l as any).label || '—' }}</td>
          <td class="px-2 py-1">
            <span class="px-1 rounded text-[10px] font-bold" :class="CASE_COLORS[(l as any).loadCase ?? 'D']">
              {{ (l as any).loadCase ?? 'D' }}
            </span>
            <span class="text-slate-400 text-[10px] ml-0.5">{{ CASE_NAMES[(l as any).loadCase ?? 'D'] }}</span>
          </td>
          <td class="px-2 py-1 capitalize">{{ l.type.replace(/_/g, ' ') }}</td>
          <td class="px-2 py-1">
            <span v-if="l.type === 'distributed_load'">{{ memberName((l as DistributedLoad).memberId) }}</span>
            <span v-else>{{ nodeName((l as PointLoad | MomentLoad).nodeId) }}</span>
          </td>
          <td class="px-2 py-1 text-right font-mono">
            <span v-if="l.type === 'point_load'">
              Fx={{ settings.toForce((l as PointLoad).fx).toFixed(3) }}, Fy={{ settings.toForce((l as PointLoad).fy).toFixed(3) }} {{ settings.forceUnit }}
            </span>
            <span v-else-if="l.type === 'distributed_load'">
              w₁={{ settings.toForce((l as DistributedLoad).w1).toFixed(3) }}, w₂={{ settings.toForce((l as DistributedLoad).w2).toFixed(3) }} {{ settings.distForceLabel }}
            </span>
            <span v-else>
              Mz={{ settings.toMoment((l as MomentLoad).mz).toFixed(3) }} {{ settings.momentLabel }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
