<script setup lang="ts">
import { useSolverStore } from '@/stores/solverStore'
import { useStructureStore } from '@/stores/structureStore'
import { useSettingsStore } from '@/stores/settingsStore'
import ReactionTable from '@/components/analysis/ReactionTable.vue'
import DisplacementTable from '@/components/analysis/DisplacementTable.vue'
import DiagramPanel from '@/components/analysis/DiagramPanel.vue'
import DesignAssessmentPanel from '@/components/analysis/DesignAssessmentPanel.vue'

const solver = useSolverStore()
const structure = useStructureStore()
const settings = useSettingsStore()

function memberName(id: string) {
  const m = structure.memberById(id)
  return m?.label || id.slice(0, 6)
}
</script>

<template>
  <div class="p-6 space-y-6 overflow-y-auto h-full">
    <div v-if="!solver.result" class="text-slate-400 text-center mt-12">
      Run analysis in Workspace first.
    </div>

    <template v-else-if="solver.result.success">
      <div class="grid grid-cols-2 gap-6">
        <ReactionTable />
        <DisplacementTable />
      </div>

      <DiagramPanel />

      <DesignAssessmentPanel />

      <div>
        <div class="text-sm font-medium text-slate-700 mb-2">Member End Forces</div>
        <table class="w-full text-xs border-collapse">
          <thead class="bg-slate-100">
            <tr>
              <th class="px-2 py-1 text-left text-slate-600">Member</th>
              <th class="px-2 py-1 text-right text-slate-600">N₁ ({{ settings.forceUnit }})</th>
              <th class="px-2 py-1 text-right text-slate-600">V₁ ({{ settings.forceUnit }})</th>
              <th class="px-2 py-1 text-right text-slate-600">M₁ ({{ settings.momentLabel }})</th>
              <th class="px-2 py-1 text-right text-slate-600">N₂ ({{ settings.forceUnit }})</th>
              <th class="px-2 py-1 text-right text-slate-600">V₂ ({{ settings.forceUnit }})</th>
              <th class="px-2 py-1 text-right text-slate-600">M₂ ({{ settings.momentLabel }})</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="mr in solver.result.memberResults" :key="mr.memberId" class="border-b border-slate-100">
              <td class="px-2 py-1">{{ memberName(mr.memberId) }}</td>
              <td v-for="(v, idx) in mr.endForces" :key="idx" class="px-2 py-1 text-right font-mono">
                {{ (idx % 3 === 2 ? settings.toMoment(v) : settings.toForce(v)).toFixed(3) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-else class="bg-red-50 border border-red-200 rounded p-4 text-red-700 text-sm">
      {{ solver.result.error }}
    </div>
  </div>
</template>
