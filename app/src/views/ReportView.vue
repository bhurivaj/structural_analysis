<script setup lang="ts">
import { computed } from 'vue'
import { useSolverStore } from '@/stores/solverStore'
import { useStructureStore } from '@/stores/structureStore'
import { useLoadsStore } from '@/stores/loadsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSteelProfileStore } from '@/stores/steelProfileStore'
import { usePrintReport } from '@/composables/usePrintReport'
import { performDesignCheck } from '@/utils/designCheck'
import ReportLoadsSection from '@/components/report/ReportLoadsSection.vue'
import ReportResultsSections from '@/components/report/ReportResultsSections.vue'

const solver = useSolverStore()
const structure = useStructureStore()
const loads = useLoadsStore()
const settings = useSettingsStore()
const steelProfiles = useSteelProfileStore()
const { print } = usePrintReport()

const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

function memberLength(m: ReturnType<typeof structure.memberById>): number {
  if (!m) return 0
  const n1 = structure.nodeById(m.startNodeId)
  const n2 = structure.nodeById(m.endNodeId)
  if (!n1 || !n2) return 0
  return Math.sqrt((n2.x - n1.x) ** 2 + (n2.y - n1.y) ** 2)
}

function nodeName(id: string) { return structure.nodeById(id)?.label || id.slice(0, 6) }

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

const usedProfiles = computed(() => {
  const seen = new Set<string>()
  const result = []
  for (const m of structure.members) {
    if (m.steelProfileId && !seen.has(m.steelProfileId)) {
      seen.add(m.steelProfileId)
      const p = steelProfiles.profileById(m.steelProfileId)
      if (p) result.push(p)
    }
  }
  return result
})
</script>

<template>
  <div class="h-full overflow-y-auto print:overflow-visible print:h-auto">
    <div class="no-print flex justify-end px-6 pt-4">
      <button class="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700" @click="print">
        Print / Save PDF
      </button>
    </div>

    <div class="max-w-4xl mx-auto px-8 py-6 space-y-6 text-sm print:px-2 print:max-w-full">

      <!-- 1. Header -->
      <section>
        <h1 class="text-xl font-bold text-slate-800 mb-1">{{ settings.projectName || 'Structural Analysis Report' }}</h1>
        <div class="text-xs text-slate-500 space-x-4 mb-1">
          <span>Date: {{ today }}</span>
          <span>Units: {{ settings.unitDisplay }}</span>
          <span>Code: AISC 360 (LRFD)</span>
          <span>Software: StructCalc</span>
        </div>
        <div v-if="settings.engineerName" class="text-xs text-slate-600">Engineer: {{ settings.engineerName }}</div>
      </section>

      <!-- 1. Design Criteria -->
      <section class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">1. Design Criteria &amp; Assumptions</h2>
        <table class="text-xs border-collapse w-full">
          <tbody>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500 w-64">Design Code</td><td class="font-medium">AISC 360-10 (LRFD)</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">φ<sub>c</sub></td><td class="font-mono">0.90</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">φ<sub>t</sub></td><td class="font-mono">0.90</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">φ<sub>b</sub></td><td class="font-mono">0.90</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">φ<sub>v</sub></td><td class="font-mono">1.00</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">PASS threshold</td><td class="font-mono">UR &lt; {{ settings.urMarginal }}</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">MARGINAL threshold</td><td class="font-mono">{{ settings.urMarginal }} &le; UR &lt; {{ settings.urFail }}</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">FAIL threshold</td><td class="font-mono">UR &ge; {{ settings.urFail }}</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">Default F<sub>y</sub></td><td class="font-mono">{{ settings.defaultFy }} MPa</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">Default E</td><td class="font-mono">{{ settings.defaultE.toLocaleString() }} MPa</td></tr>
            <tr><td class="pr-6 py-0.5 text-slate-500">Steel Standard</td><td class="font-medium">TIS 1228 (Thai Industrial Standard)</td></tr>
          </tbody>
        </table>
      </section>

      <!-- 2. Model Summary -->
      <section class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">2. Model Summary</h2>
        <table class="text-xs border-collapse">
          <tr><td class="pr-6 py-0.5 text-slate-500">Type</td><td class="font-medium capitalize">{{ structure.structureType }}</td></tr>
          <tr><td class="pr-6 py-0.5 text-slate-500">Nodes</td><td>{{ structure.nodes.length }}</td></tr>
          <tr><td class="pr-6 py-0.5 text-slate-500">Members</td><td>{{ structure.members.length }}</td></tr>
          <tr><td class="pr-6 py-0.5 text-slate-500">Loads</td><td>{{ loads.loads.length }}</td></tr>
          <tr v-if="solver.result?.success">
            <td class="pr-6 py-0.5 text-slate-500">Design Result</td>
            <td :class="passCount === designResults.length ? 'text-green-600 font-medium' : 'text-red-600 font-medium'">
              {{ passCount }}/{{ designResults.length }} members PASS
            </td>
          </tr>
        </table>
      </section>

      <!-- 3. Nodes -->
      <section class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">3. Nodes</h2>
        <table class="w-full text-xs border-collapse">
          <thead class="bg-slate-100">
            <tr>
              <th class="px-2 py-1 text-left">Node</th>
              <th class="px-2 py-1 text-right">X ({{ settings.lengthUnit }})</th>
              <th class="px-2 py-1 text-right">Y ({{ settings.lengthUnit }})</th>
              <th class="px-2 py-1 text-left">Support</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in structure.nodes" :key="n.id" class="border-b border-slate-100">
              <td class="px-2 py-1 font-medium">{{ n.label || n.id.slice(0,6) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ settings.toLength(n.x).toFixed(4) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ settings.toLength(n.y).toFixed(4) }}</td>
              <td class="px-2 py-1 capitalize">{{ n.support }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 4. Members -->
      <section class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">4. Members</h2>
        <table class="w-full text-xs border-collapse">
          <thead class="bg-slate-100">
            <tr>
              <th class="px-2 py-1 text-left">Member</th>
              <th class="px-2 py-1 text-left">Start</th>
              <th class="px-2 py-1 text-left">End</th>
              <th class="px-2 py-1 text-right">Length ({{ settings.lengthUnit }})</th>
              <th class="px-2 py-1 text-left">Profile</th>
              <th class="px-2 py-1 text-right">E (MPa)</th>
              <th class="px-2 py-1 text-right">A (mm<sup>2</sup>)</th>
              <th class="px-2 py-1 text-right">I (mm<sup>4</sup>)</th>
              <th class="px-2 py-1 text-left">Type</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in structure.members" :key="m.id" class="border-b border-slate-100">
              <td class="px-2 py-1 font-medium">{{ m.label || m.id.slice(0,6) }}</td>
              <td class="px-2 py-1">{{ nodeName(m.startNodeId) }}</td>
              <td class="px-2 py-1">{{ nodeName(m.endNodeId) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ settings.toLength(memberLength(structure.memberById(m.id))).toFixed(3) }}</td>
              <td class="px-2 py-1">{{ m.steelProfileId ? (steelProfiles.profileById(m.steelProfileId)?.designation ?? '—') : 'Manual' }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ m.E.toLocaleString() }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ m.A.toLocaleString() }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ m.I.toLocaleString() }}</td>
              <td class="px-2 py-1">
                <span v-if="m.tensionOnly" class="text-orange-600 font-medium">Cable</span>
                <span v-else-if="m.isTruss" class="text-slate-500">Truss</span>
                <span v-else class="text-slate-500">Frame</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 5. Steel Profile Parameters -->
      <section v-if="usedProfiles.length > 0" class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">5. Steel Profile Parameters</h2>
        <table class="w-full text-xs border-collapse">
          <thead class="bg-slate-100">
            <tr>
              <th class="px-2 py-1 text-left">Profile</th>
              <th class="px-2 py-1 text-right">d (mm)</th>
              <th class="px-2 py-1 text-right">b<sub>f</sub> (mm)</th>
              <th class="px-2 py-1 text-right">t<sub>f</sub> (mm)</th>
              <th class="px-2 py-1 text-right">t<sub>w</sub> (mm)</th>
              <th class="px-2 py-1 text-right">A (mm<sup>2</sup>)</th>
              <th class="px-2 py-1 text-right">I<sub>x</sub> (mm<sup>4</sup>)</th>
              <th class="px-2 py-1 text-right">I<sub>y</sub> (mm<sup>4</sup>)</th>
              <th class="px-2 py-1 text-right">S<sub>x</sub> (mm<sup>3</sup>)</th>
              <th class="px-2 py-1 text-right">r<sub>y</sub> (mm)</th>
              <th class="px-2 py-1 text-right">F<sub>y</sub> (MPa)</th>
              <th class="px-2 py-1 text-right">mass (kg/m)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in usedProfiles" :key="p.id" class="border-b border-slate-100">
              <td class="px-2 py-1 font-medium">{{ p.designation }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ p.d }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ p.bf }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ p.tf }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ p.tw }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ p.A.toLocaleString() }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ p.Ix.toLocaleString() }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ p.Iy.toLocaleString() }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ p.Sx.toLocaleString() }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ p.ry.toFixed(1) }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ p.Fy }}</td>
              <td class="px-2 py-1 text-right font-mono">{{ p.mass.toFixed(1) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 6+7. Load Combinations + Applied Loads -->
      <ReportLoadsSection />

      <!-- 8. Structure Diagram -->
      <section class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">8. Structure Diagram</h2>
        <div v-if="solver.snapshotDataUrl" class="border border-slate-200 rounded overflow-hidden bg-white">
          <img :src="solver.snapshotDataUrl" class="w-full object-contain" style="display:block;max-height:320px" alt="Structure diagram" />
        </div>
        <p v-else class="text-xs text-slate-400 italic">Run analysis on the Workspace tab to generate diagram.</p>
      </section>

      <!-- 9–12. Solver Results -->
      <ReportResultsSections />

      <!-- Footer -->
      <section class="border-t border-slate-200 pt-4 text-xs text-slate-400 text-center">
        Generated by StructCalc · {{ new Date().toISOString() }}
      </section>

    </div>
  </div>
</template>

<style>
@media print {
  html, body { overflow: visible !important; height: auto !important; }
  #app, main, .h-screen, .h-full, .overflow-hidden, .overflow-y-auto {
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
  }
  .no-print { display: none !important; }
  nav { display: none !important; }
  body { font-size: 9pt; margin: 0; }
  .max-w-4xl { max-width: 100% !important; }
  .px-8 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
  table { font-size: 7.5pt; width: 100% !important; table-layout: auto; }
  th, td { padding: 2px 4px !important; }
  img { max-height: 180px !important; page-break-inside: avoid; }
  section { page-break-inside: avoid; }
}
</style>
