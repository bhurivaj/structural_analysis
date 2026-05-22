<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settingsStore'
import type { ForceUnit, LengthUnit, StressUnit } from '@/stores/settingsStore'

const settings = useSettingsStore()
const showSettings = defineModel<boolean>('open', { default: false })

const localProjectName = ref(settings.projectName)
const localEngineerName = ref(settings.engineerName)
const localForceUnit = ref<ForceUnit>(settings.forceUnit)
const localLengthUnit = ref<LengthUnit>(settings.lengthUnit)
const localStressUnit = ref<StressUnit>(settings.stressUnit)
const localDefaultE = ref(settings.defaultE)
const localDefaultFy = ref(settings.defaultFy)
const localDefaultA = ref(settings.defaultA)
const localDefaultI = ref(settings.defaultI)
const localDeformedScale = ref(settings.deformedScale)
const localUrMarginal = ref(settings.urMarginal)
const localUrFail = ref(settings.urFail)

function handleSave() {
  settings.projectName = localProjectName.value
  settings.engineerName = localEngineerName.value
  settings.forceUnit = localForceUnit.value
  settings.lengthUnit = localLengthUnit.value
  settings.stressUnit = localStressUnit.value
  settings.defaultE = localDefaultE.value
  settings.defaultFy = localDefaultFy.value
  settings.defaultA = localDefaultA.value
  settings.defaultI = localDefaultI.value
  settings.deformedScale = localDeformedScale.value
  settings.urMarginal = localUrMarginal.value
  settings.urFail = localUrFail.value
  settings.save()
  showSettings.value = false
}

function handleCancel() {
  localProjectName.value = settings.projectName
  localEngineerName.value = settings.engineerName
  localForceUnit.value = settings.forceUnit
  localLengthUnit.value = settings.lengthUnit
  localStressUnit.value = settings.stressUnit
  localDefaultE.value = settings.defaultE
  localDefaultFy.value = settings.defaultFy
  localDefaultA.value = settings.defaultA
  localDefaultI.value = settings.defaultI
  localDeformedScale.value = settings.deformedScale
  localUrMarginal.value = settings.urMarginal
  localUrFail.value = settings.urFail
  showSettings.value = false
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="showSettings"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      @click.self="handleCancel"
    >
      <div class="bg-white rounded-xl shadow-2xl p-6 w-96 max-h-96 overflow-y-auto">
        <h2 class="text-lg font-semibold text-slate-800 mb-4">Settings</h2>

        <!-- Project Info -->
        <div class="space-y-3 mb-6 pb-6 border-b border-slate-200">
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Project Name</label>
            <input
              v-model="localProjectName"
              type="text"
              class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
              placeholder="(optional)"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Engineer Name</label>
            <input
              v-model="localEngineerName"
              type="text"
              class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
              placeholder="(optional)"
            />
          </div>
        </div>

        <!-- Display Units -->
        <div class="space-y-3 mb-6 pb-6 border-b border-slate-200">
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Force Unit</label>
            <select v-model="localForceUnit" class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="kN">kN</option>
              <option value="N">N</option>
              <option value="tf">tf (metric ton)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Length Unit</label>
            <select v-model="localLengthUnit" class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="m">m (meters)</option>
              <option value="cm">cm (centimeters)</option>
              <option value="mm">mm (millimeters)</option>
              <option value="ft">ft (feet)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Stress Unit</label>
            <select v-model="localStressUnit" class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="MPa">MPa</option>
              <option value="kPa">kPa</option>
              <option value="ksc">ksc (kg/cm²)</option>
              <option value="tf/cm²">tf/cm²</option>
            </select>
          </div>
        </div>

        <!-- Default Parameters -->
        <div class="space-y-3 mb-6 pb-6 border-b border-slate-200">
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Default E (MPa)</label>
            <input
              v-model.number="localDefaultE"
              type="number"
              class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Default Fy (MPa)</label>
            <input
              v-model.number="localDefaultFy"
              type="number"
              class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Default A (mm²)</label>
            <input
              v-model.number="localDefaultA"
              type="number"
              class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Default I (mm⁴)</label>
            <input
              v-model.number="localDefaultI"
              type="number"
              class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
          </div>
        </div>

        <!-- Deformed Scale -->
        <div class="space-y-2 mb-6">
          <label class="block text-xs font-medium text-slate-500">Deformed Shape Amplification: {{ (localDeformedScale / 100).toFixed(1) }}x</label>
          <input
            v-model.number="localDeformedScale"
            type="range"
            min="0"
            max="5000"
            step="100"
            class="w-full"
          />
        </div>

        <!-- Design Criteria -->
        <div class="space-y-3 mb-6 pb-6 border-b border-slate-200">
          <div class="text-xs font-semibold text-slate-600 uppercase tracking-wide">Design Criteria</div>
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Marginal Threshold (UR)</label>
            <input
              v-model.number="localUrMarginal"
              type="number"
              step="0.05"
              min="0"
              max="1"
              class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
            <p class="text-xs text-slate-400 mt-0.5">UR ≥ this value → MARGINAL (default 0.8)</p>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-500 mb-1">Fail Threshold (UR)</label>
            <input
              v-model.number="localUrFail"
              type="number"
              step="0.05"
              min="0"
              class="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
            />
            <p class="text-xs text-slate-400 mt-0.5">UR ≥ this value → FAIL (default 1.0)</p>
          </div>
        </div>

        <!-- Buttons -->
        <div class="flex gap-2 justify-end">
          <button
            class="px-3 py-1.5 text-sm text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
            @click="handleCancel"
          >
            Cancel
          </button>
          <button
            class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
            @click="handleSave"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
