<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLoadCasesStore } from '@/stores/loadCasesStore'
import type { LoadCaseCategory, CaseFactor } from '@/types/loadCases'

const store = useLoadCasesStore()

const expandedId = ref<string | null>(null)
const newComboName = ref('')
const addingNew = ref(false)
const newFactors = ref<CaseFactor[]>([{ case: 'D', factor: 1.0 }])

const CASES: LoadCaseCategory[] = ['D', 'L', 'W', 'E', 'S']
const CASE_LABELS: Record<LoadCaseCategory, string> = { D: 'D', L: 'L', W: 'W', E: 'E', S: 'S' }
const CASE_COLORS: Record<LoadCaseCategory, string> = {
  D: 'bg-slate-200 text-slate-700',
  L: 'bg-blue-100 text-blue-700',
  W: 'bg-sky-100 text-sky-700',
  E: 'bg-red-100 text-red-700',
  S: 'bg-violet-100 text-violet-700',
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function selectActive(id: string) {
  store.setActive(id)
}

function addFactorRow(factors: CaseFactor[]) {
  factors.push({ case: 'D', factor: 1.0 })
}

function removeFactorRow(factors: CaseFactor[], index: number) {
  factors.splice(index, 1)
}

function saveEdit(id: string, factors: CaseFactor[], name: string) {
  store.updateCombination(id, { name, factors: factors.map(f => ({ ...f })) })
  expandedId.value = null
}

function deleteCombo(id: string) {
  store.deleteCombination(id)
  if (expandedId.value === id) expandedId.value = null
}

function startNew() {
  newComboName.value = ''
  newFactors.value = [{ case: 'D', factor: 1.0 }]
  addingNew.value = true
}

function confirmNew() {
  if (!newComboName.value.trim()) return
  const added = store.addCombination({ name: newComboName.value.trim(), factors: newFactors.value.map(f => ({ ...f })), isCustom: true })
  store.setActive(added.id)
  addingNew.value = false
}

function cancelNew() {
  addingNew.value = false
}

const editNames = computed(() => {
  const map: Record<string, string> = {}
  store.combinations.forEach(c => { map[c.id] = c.name })
  return map
})
const editNames2 = ref<Record<string, string>>({})

function getEditName(id: string): string {
  return editNames2.value[id] ?? store.combinations.find(c => c.id === id)?.name ?? ''
}
function setEditName(id: string, val: string) {
  editNames2.value[id] = val
}
</script>

<template>
  <div class="p-3 space-y-2">
    <div class="font-medium text-sm text-slate-700">Load Combinations</div>

    <div
      v-for="combo in store.combinations"
      :key="combo.id"
      class="rounded border text-xs"
      :class="store.activeCombinationId === combo.id ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'"
    >
      <!-- Header row -->
      <div class="flex items-center gap-2 px-2 py-1.5 cursor-pointer" @click="selectActive(combo.id)">
        <span
          class="w-3 h-3 rounded-full border-2 shrink-0"
          :class="store.activeCombinationId === combo.id ? 'border-blue-500 bg-blue-500' : 'border-slate-300'"
        />
        <span class="flex-1 font-medium text-slate-700">{{ combo.name }}</span>
        <span class="flex gap-1">
          <span
            v-for="f in combo.factors"
            :key="f.case"
            class="px-1 rounded text-[10px] font-bold"
            :class="CASE_COLORS[f.case]"
          >{{ f.case }}×{{ f.factor }}</span>
        </span>
        <button
          class="text-slate-400 hover:text-slate-600 ml-1"
          @click.stop="toggleExpand(combo.id)"
          :title="expandedId === combo.id ? 'Collapse' : 'Edit factors'"
        >{{ expandedId === combo.id ? '▲' : '▼' }}</button>
      </div>

      <!-- Expanded edit area -->
      <div v-if="expandedId === combo.id" class="border-t border-slate-100 px-2 pb-2 pt-1 space-y-1.5">
        <label class="flex flex-col gap-0.5">
          <span class="text-[10px] text-slate-400">Name</span>
          <input
            :value="getEditName(combo.id)"
            @input="setEditName(combo.id, ($event.target as HTMLInputElement).value)"
            class="px-1.5 py-0.5 border border-slate-300 rounded text-xs"
          />
        </label>
        <div class="space-y-1">
          <div v-for="(f, i) in combo.factors" :key="i" class="flex items-center gap-1">
            <select v-model="f.case" class="px-1 py-0.5 border border-slate-300 rounded text-xs w-16">
              <option v-for="c in CASES" :key="c" :value="c">{{ c }}</option>
            </select>
            <span class="text-slate-400">×</span>
            <input
              type="number"
              v-model.number="f.factor"
              step="0.1"
              class="px-1 py-0.5 border border-slate-300 rounded text-xs w-16"
            />
            <button class="text-red-400 hover:text-red-600 text-xs" @click="removeFactorRow(combo.factors, i)">×</button>
          </div>
        </div>
        <button class="text-blue-500 hover:text-blue-700 text-xs" @click="addFactorRow(combo.factors)">＋ Add factor</button>
        <div class="flex gap-1 pt-1">
          <button
            class="flex-1 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            @click="saveEdit(combo.id, combo.factors, getEditName(combo.id))"
          >Save</button>
          <button
            v-if="combo.isCustom"
            class="py-1 px-2 text-xs bg-red-500 text-white rounded hover:bg-red-600"
            @click="deleteCombo(combo.id)"
          >Delete</button>
          <button class="py-1 px-2 text-xs bg-slate-200 rounded hover:bg-slate-300" @click="expandedId = null">Cancel</button>
        </div>
      </div>
    </div>

    <!-- New combination form -->
    <div v-if="addingNew" class="rounded border border-dashed border-blue-300 bg-blue-50 p-2 space-y-1.5 text-xs">
      <input
        v-model="newComboName"
        placeholder="Combination name"
        class="w-full px-1.5 py-0.5 border border-slate-300 rounded text-xs"
      />
      <div class="space-y-1">
        <div v-for="(f, i) in newFactors" :key="i" class="flex items-center gap-1">
          <select v-model="f.case" class="px-1 py-0.5 border border-slate-300 rounded text-xs w-16">
            <option v-for="c in CASES" :key="c" :value="c">{{ c }}</option>
          </select>
          <span class="text-slate-400">×</span>
          <input type="number" v-model.number="f.factor" step="0.1" class="px-1 py-0.5 border border-slate-300 rounded text-xs w-16" />
          <button class="text-red-400 hover:text-red-600" @click="removeFactorRow(newFactors, i)">×</button>
        </div>
      </div>
      <button class="text-blue-500 hover:text-blue-700 text-xs" @click="addFactorRow(newFactors)">＋ Add factor</button>
      <div class="flex gap-1 pt-0.5">
        <button class="flex-1 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700" @click="confirmNew">Add</button>
        <button class="py-1 px-2 text-xs bg-slate-200 rounded hover:bg-slate-300" @click="cancelNew">Cancel</button>
      </div>
    </div>

    <button
      v-if="!addingNew"
      class="w-full py-1.5 text-xs border border-dashed border-slate-300 rounded text-slate-500 hover:border-blue-400 hover:text-blue-600"
      @click="startNew"
    >＋ New Combination</button>

    <p class="text-[10px] text-slate-400 pt-1">
      Active combination is used when running analysis. Loads not in any combination factor are excluded.
    </p>
  </div>
</template>
