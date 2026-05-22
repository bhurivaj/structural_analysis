<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSolverStore } from '@/stores/solverStore'
import { useStructureStore } from '@/stores/structureStore'

const solver = useSolverStore()
const structure = useStructureStore()

const selectedDiagramMode = ref<'N' | 'V' | 'M'>('M')
const selectedMemberIdx = ref(0)

const memberOptions = computed(() =>
  solver.result?.memberResults.map((mr, idx) => ({
    idx,
    label: structure.memberById(mr.memberId)?.label || mr.memberId.slice(0, 6),
  })) ?? []
)

const currentMemberResult = computed(() =>
  solver.result?.memberResults[selectedMemberIdx.value]
)

function getValues() {
  if (!currentMemberResult.value) return []
  const mode = selectedDiagramMode.value
  if (mode === 'N') return currentMemberResult.value.N
  if (mode === 'V') return currentMemberResult.value.V
  return currentMemberResult.value.M
}

const values = computed(() => getValues())
const stations = computed(() => currentMemberResult.value?.stations ?? [])

const minVal = computed(() => Math.min(...values.value, 0))
const maxVal = computed(() => Math.max(...values.value, 0))
const range = computed(() => maxVal.value - minVal.value || 1)

function yPos(v: number) {
  return 100 - ((v - minVal.value) / range.value) * 80 - 10
}

function xPos(i: number) {
  return 10 + (i / (values.value.length - 1 || 1)) * 80
}
</script>

<template>
  <div class="border-t border-slate-200 pt-4">
    <div class="text-sm font-medium text-slate-700 mb-2">Internal Force Diagrams</div>

    <div class="space-y-3 bg-slate-50 rounded p-3">
      <!-- Controls -->
      <div class="flex gap-2 items-center justify-between flex-wrap">
        <select v-model.number="selectedMemberIdx" class="px-2 py-1 text-xs border border-slate-300 rounded">
          <option v-for="opt in memberOptions" :key="opt.idx" :value="opt.idx">
            Member {{ opt.label }}
          </option>
        </select>

        <div class="flex gap-1">
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
        </div>
      </div>

      <!-- SVG Diagram -->
      <svg viewBox="0 0 100 100" class="w-full h-40 border border-slate-300 rounded bg-white">
        <!-- Axes -->
        <line x1="10" y1="90" x2="90" y2="90" stroke="#d1d5db" stroke-width="0.5" />
        <line x1="10" y1="10" x2="10" y2="90" stroke="#d1d5db" stroke-width="0.5" />

        <!-- Zero line (if applicable) -->
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

        <!-- Diagram bars/areas -->
        <g v-if="values.length > 0">
          <!-- Draw filled area under curve -->
          <polyline
            :points="values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ')"
            fill="none"
            stroke="#3b82f6"
            stroke-width="0.8"
          />

          <!-- Vertical bars from zero line -->
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

          <!-- Points -->
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
      <div v-if="values.length > 0" class="text-xs text-slate-600 space-y-0.5">
        <div>Max: <span class="font-mono font-semibold">{{ maxVal.toFixed(3) }}</span></div>
        <div>Min: <span class="font-mono font-semibold">{{ minVal.toFixed(3) }}</span></div>
      </div>
    </div>
  </div>
</template>
