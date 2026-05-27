<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSolverStore } from '@/stores/solverStore'
import { useStructureStore } from '@/stores/structureStore'

const solver = useSolverStore()
const structure = useStructureStore()

const selectedDiagramMode = ref<'N' | 'V' | 'M' | 'Vz' | 'My' | 'T'>('M')
const selectedMemberIdx = ref(0)
const showEnvelope = ref(false)

const memberOptions = computed(() =>
  solver.result?.memberResults.map((mr, idx) => ({
    idx,
    label: structure.memberById(mr.memberId)?.label || mr.memberId.slice(0, 6),
  })) ?? []
)

const hasEnvelope = computed(() => solver.envelopeResult?.success && (solver.envelopeResult.diagramEnvelopes?.length ?? 0) > 0)

const currentMemberResult = computed(() =>
  solver.result?.memberResults[selectedMemberIdx.value]
)

const currentMemberId = computed(() => currentMemberResult.value?.memberId)

const envelopeDiagram = computed(() => {
  if (!hasEnvelope.value || !currentMemberId.value) return null
  return solver.envelopeResult!.diagramEnvelopes!.find(d => d.memberId === currentMemberId.value) ?? null
})

const has3dForces = computed(() =>
  solver.result?.memberResults.some(mr => mr.Vz.some(v => Math.abs(v) > 1e-9)) ?? false
)

function getValues() {
  if (!currentMemberResult.value) return []
  const mode = selectedDiagramMode.value
  if (mode === 'N')  return currentMemberResult.value.N
  if (mode === 'V')  return currentMemberResult.value.V
  if (mode === 'Vz') return currentMemberResult.value.Vz
  if (mode === 'My') return currentMemberResult.value.My
  if (mode === 'T')  return currentMemberResult.value.T
  return currentMemberResult.value.M
}

function getEnvelopeMin() {
  if (!envelopeDiagram.value) return []
  const mode = selectedDiagramMode.value
  if (mode === 'N') return envelopeDiagram.value.minN
  if (mode === 'V') return envelopeDiagram.value.minV
  if (mode === 'Vz' || mode === 'My' || mode === 'T') return []  // envelope not tracked for 3D modes yet
  return envelopeDiagram.value.minM
}

function getEnvelopeMax() {
  if (!envelopeDiagram.value) return []
  const mode = selectedDiagramMode.value
  if (mode === 'N') return envelopeDiagram.value.maxN
  if (mode === 'V') return envelopeDiagram.value.maxV
  if (mode === 'Vz' || mode === 'My' || mode === 'T') return []  // envelope not tracked for 3D modes yet
  return envelopeDiagram.value.maxM
}

const values = computed(() => getValues())
const envMin = computed(() => getEnvelopeMin())
const envMax = computed(() => getEnvelopeMax())
const stations = computed(() => currentMemberResult.value?.stations ?? [])

const allValues = computed(() => {
  if (showEnvelope.value && envelopeDiagram.value) {
    return [...envMin.value, ...envMax.value]
  }
  return values.value
})

const minVal = computed(() => Math.min(...allValues.value, 0))
const maxVal = computed(() => Math.max(...allValues.value, 0))
const range = computed(() => maxVal.value - minVal.value || 1)

function yPos(v: number) {
  return 100 - ((v - minVal.value) / range.value) * 80 - 10
}

function xPos(i: number) {
  const len = showEnvelope.value && envMax.value.length > 0 ? envMax.value.length : values.value.length
  return 10 + (i / (len - 1 || 1)) * 80
}

const bandPoints = computed(() => {
  if (!showEnvelope.value || envMax.value.length === 0) return ''
  const top = envMax.value.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')
  const bottom = [...envMin.value].reverse().map((v, i) => `${xPos(envMin.value.length - 1 - i)},${yPos(v)}`).join(' ')
  return `${top} ${bottom}`
})
</script>

<template>
  <div data-testid="diagram-panel" class="border-t border-slate-200 pt-4">
    <div class="text-sm font-medium text-slate-700 mb-2">Internal Force Diagrams</div>

    <div class="space-y-3 bg-slate-50 rounded p-3">
      <!-- Controls -->
      <div class="flex gap-2 items-center justify-between flex-wrap">
        <select v-model.number="selectedMemberIdx" class="px-2 py-1 text-xs border border-slate-300 rounded">
          <option v-for="opt in memberOptions" :key="opt.idx" :value="opt.idx">
            Member {{ opt.label }}
          </option>
        </select>

        <div class="flex gap-1 flex-wrap">
          <button
            v-for="mode in (['N', 'V', 'M'] as const)"
            :key="mode"
            class="px-2 py-1 text-xs rounded transition-colors"
            :class="selectedDiagramMode === mode
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'"
            @click="selectedDiagramMode = mode"
          >
            {{ mode }}
          </button>
          <template v-if="has3dForces">
            <span class="w-px bg-slate-300 self-stretch mx-0.5" />
            <button
              v-for="mode in (['Vz', 'My', 'T'] as const)"
              :key="mode"
              class="px-2 py-1 text-xs rounded transition-colors"
              :class="selectedDiagramMode === mode
                ? 'bg-violet-600 text-white'
                : 'bg-white border border-slate-300 text-slate-500 hover:bg-slate-100'"
              @click="selectedDiagramMode = mode"
            >
              {{ mode }}
            </button>
          </template>
        </div>
      </div>

      <!-- Envelope toggle -->
      <div v-if="hasEnvelope" class="flex gap-1">
        <button
          class="flex-1 py-0.5 text-xs rounded transition-colors"
          :class="!showEnvelope ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-500'"
          @click="showEnvelope = false"
        >Active</button>
        <button
          class="flex-1 py-0.5 text-xs rounded transition-colors"
          :class="showEnvelope ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-500'"
          @click="showEnvelope = true"
        >Envelope</button>
      </div>

      <!-- SVG Diagram -->
      <svg viewBox="0 0 100 100" class="w-full h-40 border border-slate-300 rounded bg-white">
        <!-- Axes -->
        <line x1="10" y1="90" x2="90" y2="90" stroke="#d1d5db" stroke-width="0.5" />
        <line x1="10" y1="10" x2="10" y2="90" stroke="#d1d5db" stroke-width="0.5" />

        <!-- Zero line -->
        <line
          v-if="minVal < 0 && maxVal > 0"
          x1="10"
          :y1="yPos(0)"
          x2="90"
          :y2="yPos(0)"
          stroke="#e5e7eb"
          stroke-width="0.3"
          stroke-dasharray="1,1"
        />

        <!-- Envelope band -->
        <polygon
          v-if="showEnvelope && bandPoints"
          data-testid="envelope-band"
          :points="bandPoints"
          fill="#6366f1"
          fill-opacity="0.15"
          stroke="none"
        />
        <!-- Envelope max line -->
        <polyline
          v-if="showEnvelope && envMax.length > 0"
          :points="envMax.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')"
          fill="none"
          stroke="#6366f1"
          stroke-width="0.8"
        />
        <!-- Envelope min line -->
        <polyline
          v-if="showEnvelope && envMin.length > 0"
          :points="envMin.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')"
          fill="none"
          stroke="#6366f1"
          stroke-width="0.8"
          stroke-dasharray="2,1"
        />

        <!-- Active diagram -->
        <g v-if="!showEnvelope && values.length > 0">
          <polyline
            :points="values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')"
            fill="none"
            stroke="#3b82f6"
            stroke-width="0.8"
          />
          <line
            v-for="(v, i) in values"
            :key="`bar-${i}`"
            :x1="xPos(i)"
            :y1="yPos(0)"
            :x2="xPos(i)"
            :y2="yPos(v)"
            :stroke="v >= 0 ? '#3b82f6' : '#ef4444'"
            stroke-width="0.4"
          />
          <circle
            v-for="(v, i) in values"
            :key="`pt-${i}`"
            :cx="xPos(i)"
            :cy="yPos(v)"
            r="0.3"
            fill="#3b82f6"
          />
        </g>

        <!-- Labels -->
        <text x="5" y="12" font-size="3" fill="#9ca3af" text-anchor="end">{{ maxVal.toFixed(1) }}</text>
        <text x="5" y="88" font-size="3" fill="#9ca3af" text-anchor="end">{{ minVal.toFixed(1) }}</text>
      </svg>

      <!-- Stats -->
      <div v-if="showEnvelope && envMax.length > 0" class="text-xs text-slate-600 space-y-0.5">
        <div>Max: <span class="font-mono font-semibold">{{ maxVal.toFixed(3) }}</span></div>
        <div>Min: <span class="font-mono font-semibold">{{ minVal.toFixed(3) }}</span></div>
        <div class="text-indigo-600 text-[10px]">Envelope across {{ solver.envelopeResult?.perComboResults.length }} combos</div>
      </div>
      <div v-else-if="values.length > 0" class="text-xs text-slate-600 space-y-0.5">
        <div>Max: <span class="font-mono font-semibold">{{ maxVal.toFixed(3) }}</span></div>
        <div>Min: <span class="font-mono font-semibold">{{ minVal.toFixed(3) }}</span></div>
      </div>
    </div>
  </div>
</template>
