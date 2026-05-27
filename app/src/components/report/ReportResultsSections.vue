<script setup lang="ts">
import { computed } from 'vue'
import { useSolverStore } from '@/stores/solverStore'
import { useStructureStore } from '@/stores/structureStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSteelProfileStore } from '@/stores/steelProfileStore'
import { performDesignCheck } from '@/utils/designCheck'

const solver = useSolverStore()
const structure = useStructureStore()
const settings = useSettingsStore()
const steelProfiles = useSteelProfileStore()

function nodeName(id: string) { return structure.nodeById(id)?.label || id.slice(0, 6) }
function memberName(id: string) { const m = structure.memberById(id); return m?.label || id.slice(0, 6) }

const designResults = computed(() => {
  if (!solver.result?.success) return []
  return performDesignCheck(
    solver.result.memberResults,
    new Map(structure.members.map(m => [m.id, m])),
    new Map(structure.nodes.map(n => [n.id, n])),
    new Map(steelProfiles.profiles.map(p => [p.id, p])),
    settings.defaultFy,
    settings.urMarginal,
    settings.urFail,
  )
})

const passCount = computed(() => designResults.value.filter(r => r.status === 'PASS').length)
</script>

<template>
  <template v-if="solver.result?.success">

    <!-- Reactions -->
    <section class="border-t border-slate-200 pt-4">
      <h2 class="font-semibold text-slate-700 mb-2">9. Support Reactions</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead class="bg-slate-100">
            <tr>
              <th class="px-2 py-1 text-left">Node</th>
              <th class="px-2 py-1 text-right">Rx ({{ settings.forceUnit }})</th>
              <th class="px-2 py-1 text-right">Ry ({{ settings.forceUnit }})</th>
              <th class="px-2 py-1 text-right">Rz ({{ settings.forceUnit }})</th>
              <th class="px-2 py-1 text-right">Mx ({{ settings.momentLabel }})</th>
              <th class="px-2 py-1 text-right">My ({{ settings.momentLabel }})</th>
              <th class="px-2 py-1 text-right">Mz ({{ settings.momentLabel }})</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in solver.result.reactions" :key="r.nodeId" class="border-b border-slate-100">
              <td class="px-2 py-1 font-medium">{{ nodeName(r.nodeId) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ settings.toForce(r.rx).toFixed(4) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ settings.toForce(r.ry).toFixed(4) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ settings.toForce(r.rz).toFixed(4) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ settings.toMoment(r.mx).toFixed(4) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ settings.toMoment(r.my).toFixed(4) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ settings.toMoment(r.mz).toFixed(4) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Displacements -->
    <section class="border-t border-slate-200 pt-4">
      <h2 class="font-semibold text-slate-700 mb-2">10. Nodal Displacements</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead class="bg-slate-100">
            <tr>
              <th class="px-2 py-1 text-left">Node</th>
              <th class="px-2 py-1 text-right">ux ({{ settings.lengthUnit }})</th>
              <th class="px-2 py-1 text-right">uy ({{ settings.lengthUnit }})</th>
              <th class="px-2 py-1 text-right">uz ({{ settings.lengthUnit }})</th>
              <th class="px-2 py-1 text-right">rx (rad)</th>
              <th class="px-2 py-1 text-right">ry (rad)</th>
              <th class="px-2 py-1 text-right">&theta;z (rad)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in solver.result.nodeResults" :key="r.nodeId" class="border-b border-slate-100">
              <td class="px-2 py-1 font-medium">{{ nodeName(r.nodeId) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ settings.toLength(r.ux / 1000).toFixed(5) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ settings.toLength(r.uy / 1000).toFixed(5) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ settings.toLength(r.uz / 1000).toFixed(5) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ r.rx.toExponential(3) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ r.ry.toExponential(3) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ r.rz.toExponential(3) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Member End Forces -->
    <section class="border-t border-slate-200 pt-4">
      <h2 class="font-semibold text-slate-700 mb-2">11. Member End Forces</h2>
      <table class="w-full text-xs border-collapse">
        <thead class="bg-slate-100">
          <tr>
            <th class="px-2 py-1 text-left">Member</th>
            <th class="px-2 py-1 text-right">N₁ ({{ settings.forceUnit }})</th>
            <th class="px-2 py-1 text-right">V₁ ({{ settings.forceUnit }})</th>
            <th class="px-2 py-1 text-right">M₁ ({{ settings.momentLabel }})</th>
            <th class="px-2 py-1 text-right">N₂ ({{ settings.forceUnit }})</th>
            <th class="px-2 py-1 text-right">V₂ ({{ settings.forceUnit }})</th>
            <th class="px-2 py-1 text-right">M₂ ({{ settings.momentLabel }})</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="mr in solver.result.memberResults" :key="mr.memberId" class="border-b border-slate-100">
            <td class="px-2 py-1 font-medium">{{ memberName(mr.memberId) }}</td>
            <td v-for="(v, idx) in mr.endForces" :key="idx" class="px-2 py-1 text-right font-mono">
              {{ (idx % 3 === 2 ? settings.toMoment(v) : settings.toForce(v)).toFixed(3) }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Design Assessment -->
    <section class="border-t border-slate-200 pt-4">
      <h2 class="font-semibold text-slate-700 mb-2">12. Design Assessment (LRFD — AISC 360)</h2>
      <table class="w-full text-xs border-collapse">
        <thead class="bg-slate-100">
          <tr>
            <th class="px-2 py-1 text-left">Member</th>
            <th class="px-2 py-1 text-left">Profile</th>
            <th class="px-2 py-1 text-right">UR<sub>axial</sub></th>
            <th class="px-2 py-1 text-right">UR<sub>bend</sub></th>
            <th class="px-2 py-1 text-right">UR<sub>shear</sub></th>
            <th class="px-2 py-1 text-right">UR<sub>combined</sub></th>
            <th class="px-2 py-1 text-center">Status</th>
            <th class="px-2 py-1 text-left">Note</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in designResults" :key="r.memberId" class="border-b border-slate-100">
            <td class="px-2 py-1 font-medium">{{ r.memberLabel }}</td>
            <td class="px-2 py-1 text-slate-500">{{ r.profileName || 'Manual' }}</td>
            <td class="px-2 py-1 text-right font-mono" :class="r.UR_axial >= settings.urFail ? 'text-red-600' : ''">{{ r.UR_axial.toFixed(3) }}</td>
            <td class="px-2 py-1 text-right font-mono" :class="r.UR_bending >= settings.urFail ? 'text-red-600' : ''">{{ r.UR_bending.toFixed(3) }}</td>
            <td class="px-2 py-1 text-right font-mono" :class="r.UR_shear >= settings.urFail ? 'text-red-600' : ''">{{ r.UR_shear.toFixed(3) }}</td>
            <td class="px-2 py-1 text-right font-mono font-semibold"
              :class="r.UR_combined >= settings.urFail ? 'text-red-600' : r.UR_combined >= settings.urMarginal ? 'text-amber-600' : 'text-green-700'">
              {{ r.UR_combined.toFixed(3) }}
            </td>
            <td class="px-2 py-1 text-center font-semibold"
              :class="r.status === 'PASS' ? 'text-green-700' : r.status === 'MARGINAL' ? 'text-amber-600' : 'text-red-600'">
              {{ r.status === 'PASS' ? '✓' : r.status === 'MARGINAL' ? '⚠' : '✗' }} {{ r.status }}
            </td>
            <td class="px-2 py-1 text-slate-500 text-xs">{{ r.suggestion }}</td>
          </tr>
        </tbody>
      </table>
      <p class="mt-2 text-xs text-slate-500">
        {{ passCount }}/{{ designResults.length }} members pass ·
        Interaction H1-1 (AISC 360) ·
        UR<sub>combined</sub> = max(H1-1, UR<sub>shear</sub>)
      </p>
    </section>

  </template>
</template>
