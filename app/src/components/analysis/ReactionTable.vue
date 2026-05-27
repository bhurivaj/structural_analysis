<script setup lang="ts">
import { useSolverStore } from '@/stores/solverStore'
import { useStructureStore } from '@/stores/structureStore'
import { useSettingsStore } from '@/stores/settingsStore'

const solver = useSolverStore()
const structure = useStructureStore()
const settings = useSettingsStore()

function nodeName(nodeId: string) {
  return structure.nodeById(nodeId)?.label || nodeId.slice(0, 6)
}
</script>

<template>
  <div>
    <div class="text-sm font-medium text-slate-700 mb-2">Support Reactions</div>
    <div class="overflow-x-auto">
      <table class="w-full text-xs border-collapse">
        <thead class="bg-slate-100">
          <tr>
            <th class="px-2 py-1 text-left font-medium text-slate-600">Node</th>
            <th class="px-2 py-1 text-right font-medium text-slate-600">Rx ({{ settings.forceUnit }})</th>
            <th class="px-2 py-1 text-right font-medium text-slate-600">Ry ({{ settings.forceUnit }})</th>
            <th class="px-2 py-1 text-right font-medium text-slate-600">Rz ({{ settings.forceUnit }})</th>
            <th class="px-2 py-1 text-right font-medium text-slate-600">Mx ({{ settings.momentLabel }})</th>
            <th class="px-2 py-1 text-right font-medium text-slate-600">My ({{ settings.momentLabel }})</th>
            <th class="px-2 py-1 text-right font-medium text-slate-600">Mz ({{ settings.momentLabel }})</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in solver.result?.reactions" :key="r.nodeId" class="border-b border-slate-100">
            <td class="px-2 py-1">{{ nodeName(r.nodeId) }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ settings.toForce(r.rx).toFixed(3) }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ settings.toForce(r.ry).toFixed(3) }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ settings.toForce(r.rz).toFixed(3) }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ settings.toMoment(r.mx).toFixed(3) }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ settings.toMoment(r.my).toFixed(3) }}</td>
            <td class="px-2 py-1 text-right font-mono">{{ settings.toMoment(r.mz).toFixed(3) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
