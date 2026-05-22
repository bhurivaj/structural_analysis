<script setup lang="ts">
import { computed } from 'vue'
import { useSolverStore } from '@/stores/solverStore'
import { useStructureStore } from '@/stores/structureStore'
import { useLoadsStore } from '@/stores/loadsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSteelProfileStore } from '@/stores/steelProfileStore'
import { usePrintReport } from '@/composables/usePrintReport'
import { performDesignCheck } from '@/utils/designCheck'
import type { PointLoad, DistributedLoad, MomentLoad } from '@/types/loads'

const solver = useSolverStore()
const structure = useStructureStore()
const loads = useLoadsStore()
const settings = useSettingsStore()
const steelProfiles = useSteelProfileStore()
const { print } = usePrintReport()

const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

function nodeName(id: string) {
  return structure.nodeById(id)?.label || id.slice(0, 6)
}

function memberName(id: string) {
  const m = structure.memberById(id)
  return m?.label || id.slice(0, 6)
}

function memberLength(m: ReturnType<typeof structure.memberById>): number {
  if (!m) return 0
  const n1 = structure.nodeById(m.startNodeId)
  const n2 = structure.nodeById(m.endNodeId)
  if (!n1 || !n2) return 0
  return Math.sqrt((n2.x - n1.x) ** 2 + (n2.y - n1.y) ** 2)
}

const designResults = computed(() => {
  if (!solver.result?.success) return []
  const membersMap = new Map(structure.members.map(m => [m.id, m]))
  const nodesMap = new Map(structure.nodes.map(n => [n.id, n]))
  const profilesMap = new Map(steelProfiles.profiles.map(p => [p.id, p]))
  return performDesignCheck(
    solver.result.memberResults,
    membersMap,
    nodesMap,
    profilesMap,
    settings.defaultFy,
    settings.urMarginal,
    settings.urFail,
  )
})

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

const passCount = computed(() => designResults.value.filter(r => r.status === 'PASS').length)
</script>

<template>
  <div class="h-full overflow-y-auto print:overflow-visible print:h-auto">
    <div class="no-print flex justify-end px-6 pt-4">
      <button
        class="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        @click="print"
      >
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

      <!-- 2. Structure Diagram -->
      <section class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">1. Structure Diagram</h2>
        <div v-if="solver.snapshotDataUrl" class="border border-slate-200 rounded overflow-hidden bg-white">
          <img :src="solver.snapshotDataUrl" class="w-full max-h-80 object-contain print:max-h-64" style="display:block" alt="Structure diagram" />
        </div>
        <p v-else class="text-xs text-slate-400 italic">
          Run analysis on the Workspace tab to generate diagram.
        </p>
      </section>

      <!-- 3. Structure Summary -->
      <section class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">2. Structure Summary</h2>
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

      <!-- 4. Design Criteria -->
      <section class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">3. Design Criteria &amp; Assumptions</h2>
        <table class="text-xs border-collapse w-full">
          <tbody>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500 w-64">Design Code</td><td class="font-medium">AISC 360-10 (LRFD)</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">Compression factor &phi;<sub>c</sub></td><td class="font-mono">0.90</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">Tension factor &phi;<sub>t</sub></td><td class="font-mono">0.90</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">Bending factor &phi;<sub>b</sub></td><td class="font-mono">0.90</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">Shear factor &phi;<sub>v</sub></td><td class="font-mono">1.00</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">Effective Length Factor K</td><td class="font-mono">1.00 (conservative)</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">Unbraced Length L<sub>b</sub></td><td class="font-mono">Full member length</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">PASS threshold</td><td class="font-mono">UR &lt; {{ settings.urMarginal }}</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">MARGINAL threshold</td><td class="font-mono">{{ settings.urMarginal }} &le; UR &lt; {{ settings.urFail }}</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">FAIL threshold</td><td class="font-mono">UR &ge; {{ settings.urFail }}</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">Default F<sub>y</sub></td><td class="font-mono">{{ settings.defaultFy }} MPa</td></tr>
            <tr class="border-b border-slate-100"><td class="pr-6 py-0.5 text-slate-500">Default E</td><td class="font-mono">{{ settings.defaultE.toLocaleString() }} MPa</td></tr>
            <tr><td class="pr-6 py-0.5 text-slate-500">Steel Standard</td><td class="font-medium">TIS 1228 (Thai Industrial Standard)</td></tr>
          </tbody>
        </table>
      </section>

      <!-- 5. Nodes -->
      <section class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">4. Nodes</h2>
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

      <!-- 6. Members -->
      <section class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">5. Members</h2>
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
              <td class="px-2 py-1 text-right font-mono">{{ settings.toLength(memberLength(m)).toFixed(3) }}</td>
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

      <!-- 7. Steel Profile Parameters -->
      <section v-if="usedProfiles.length > 0" class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">6. Steel Profile Parameters</h2>
        <table class="w-full text-xs border-collapse">
          <thead class="bg-slate-100">
            <tr>
              <th class="px-2 py-1 text-left">Profile</th>
              <th class="px-2 py-1 text-right">d<br/>(mm)</th>
              <th class="px-2 py-1 text-right">b<sub>f</sub><br/>(mm)</th>
              <th class="px-2 py-1 text-right">t<sub>f</sub><br/>(mm)</th>
              <th class="px-2 py-1 text-right">t<sub>w</sub><br/>(mm)</th>
              <th class="px-2 py-1 text-right">A (mm<sup>2</sup>)</th>
              <th class="px-2 py-1 text-right">I<sub>x</sub><br/> (mm<sup>4</sup>)</th>
              <th class="px-2 py-1 text-right">I<sub>y</sub><br/>(mm<sup>4</sup>)</th>
              <th class="px-2 py-1 text-right">S<sub>x</sub><br/>(mm<sup>3</sup>)</th>
              <th class="px-2 py-1 text-right">r<sub>y</sub><br/>(mm)</th>
              <th class="px-2 py-1 text-right">F<sub>y</sub><br/>(MPa)</th>
              <th class="px-2 py-1 text-right">mass<br/>(kg/m)</th>
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

      <!-- 8. Applied Loads -->
      <section class="border-t border-slate-200 pt-4">
        <h2 class="font-semibold text-slate-700 mb-2">7. Applied Loads</h2>
        <table class="w-full text-xs border-collapse">
          <thead class="bg-slate-100">
            <tr>
              <th class="px-2 py-1 text-left">Label</th>
              <th class="px-2 py-1 text-left">Type</th>
              <th class="px-2 py-1 text-left">Location</th>
              <th class="px-2 py-1 text-right">Values</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in loads.loads" :key="l.id" class="border-b border-slate-100">
              <td class="px-2 py-1 font-medium">{{ (l as any).label || '—' }}</td>
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

      <template v-if="solver.result?.success">

        <!-- 9. Support Reactions -->
        <section class="border-t border-slate-200 pt-4">
          <h2 class="font-semibold text-slate-700 mb-2">8. Support Reactions</h2>
          <table class="w-full text-xs border-collapse">
            <thead class="bg-slate-100">
              <tr>
                <th class="px-2 py-1 text-left">Node</th>
                <th class="px-2 py-1 text-right">Rx ({{ settings.forceUnit }})</th>
                <th class="px-2 py-1 text-right">Ry ({{ settings.forceUnit }})</th>
                <th class="px-2 py-1 text-right">Mz ({{ settings.momentLabel }})</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in solver.result.reactions" :key="r.nodeId" class="border-b border-slate-100">
                <td class="px-2 py-1 font-medium">{{ nodeName(r.nodeId) }}</td>
                <td class="px-2 py-1 text-right font-mono">{{ settings.toForce(r.rx).toFixed(4) }}</td>
                <td class="px-2 py-1 text-right font-mono">{{ settings.toForce(r.ry).toFixed(4) }}</td>
                <td class="px-2 py-1 text-right font-mono">{{ settings.toMoment(r.mz).toFixed(4) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 10. Nodal Displacements -->
        <section class="border-t border-slate-200 pt-4">
          <h2 class="font-semibold text-slate-700 mb-2">9. Nodal Displacements</h2>
          <table class="w-full text-xs border-collapse">
            <thead class="bg-slate-100">
              <tr>
                <th class="px-2 py-1 text-left">Node</th>
                <th class="px-2 py-1 text-right">ux ({{ settings.lengthUnit }})</th>
                <th class="px-2 py-1 text-right">uy ({{ settings.lengthUnit }})</th>
                <th class="px-2 py-1 text-right">&theta;z (rad)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in solver.result.nodeResults" :key="r.nodeId" class="border-b border-slate-100">
                <td class="px-2 py-1 font-medium">{{ nodeName(r.nodeId) }}</td>
                <td class="px-2 py-1 text-right font-mono">{{ settings.toLength(r.ux / 1000).toFixed(5) }}</td>
                <td class="px-2 py-1 text-right font-mono">{{ settings.toLength(r.uy / 1000).toFixed(5) }}</td>
                <td class="px-2 py-1 text-right font-mono">{{ r.rz.toExponential(3) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- 11. Member End Forces -->
        <section class="border-t border-slate-200 pt-4">
          <h2 class="font-semibold text-slate-700 mb-2">10. Member End Forces</h2>
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

        <!-- 12. Design Assessment (LRFD) -->
        <section class="border-t border-slate-200 pt-4">
          <h2 class="font-semibold text-slate-700 mb-2">11. Design Assessment (LRFD — AISC 360)</h2>
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

      <!-- Footer -->
      <section class="border-t border-slate-200 pt-4 text-xs text-slate-400 text-center">
        Generated by StructCalc · {{ new Date().toISOString() }}
      </section>

    </div>
  </div>
</template>

<style>
@media print {
  /* Reset layout constraints that clip content */
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
