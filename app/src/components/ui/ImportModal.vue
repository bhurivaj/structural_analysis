<script setup lang="ts">
import { ref } from 'vue'
import { useStructureStore } from '@/stores/structureStore'
import { useLoadsStore } from '@/stores/loadsStore'
import { useSolverStore } from '@/stores/solverStore'
import type { SessionSnapshot } from '@/composables/useSessionCache'

const emit = defineEmits<{ close: [] }>()

const structure = useStructureStore()
const loads = useLoadsStore()
const solver = useSolverStore()

const activeTab = ref<'paste' | 'upload'>('paste')
const jsonText = ref('')
const error = ref('')
const validating = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function validateJSON(data: unknown): SessionSnapshot | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>

  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.members)) return null
  if (!Array.isArray(obj.loads) || typeof obj.structureType !== 'string') return null
  if (!['frame', 'truss'].includes(obj.structureType)) return null

  for (const n of obj.nodes) {
    const node = n as Record<string, unknown>
    if (!node.id || typeof node.x !== 'number' || typeof node.y !== 'number' || !node.support) return null
  }

  for (const m of obj.members) {
    const member = m as Record<string, unknown>
    if (!member.id || !member.startNodeId || !member.endNodeId) return null
    if (typeof member.E !== 'number' || typeof member.A !== 'number' || typeof member.I !== 'number') return null
    if (typeof member.isTruss !== 'boolean') return null
  }

  for (const l of obj.loads) {
    const load = l as Record<string, unknown>
    if (!load.id || !load.type) return null
    if (!['point_load', 'distributed_load', 'moment'].includes(load.type as string)) return null
  }

  return {
    nodes: obj.nodes as any,
    members: obj.members as any,
    loads: obj.loads as any,
    structureType: obj.structureType as any,
    savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : new Date().toISOString(),
  }
}

function handlePaste() {
  error.value = ''
  validating.value = true
  try {
    const data = JSON.parse(jsonText.value)
    const validated = validateJSON(data)
    if (!validated) {
      error.value = 'Invalid JSON structure. Check required fields: nodes[], members[], loads[], structureType'
      validating.value = false
      return
    }
    showConfirmation(validated)
  } catch (e) {
    error.value = `JSON Parse Error: ${e instanceof Error ? e.message : 'Unknown error'}`
    validating.value = false
  }
}

function handleFileUpload(event: Event) {
  error.value = ''
  validating.value = true
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    validating.value = false
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const text = e.target?.result as string
      const data = JSON.parse(text)
      const validated = validateJSON(data)
      if (!validated) {
        error.value = 'Invalid JSON structure. Check required fields: nodes[], members[], loads[], structureType'
        validating.value = false
        return
      }
      showConfirmation(validated)
    } catch (err) {
      error.value = `File Read Error: ${err instanceof Error ? err.message : 'Unknown error'}`
      validating.value = false
    }
  }
  reader.readAsText(file)
}

function showConfirmation(snapshot: SessionSnapshot) {
  validating.value = false
  const msg = `This will replace all current data:\n\n${snapshot.nodes.length} nodes\n${snapshot.members.length} members\n${snapshot.loads.length} loads\n\nContinue?`
  if (confirm(msg)) {
    doImport(snapshot)
  }
}

function doImport(snapshot: SessionSnapshot) {
  structure.loadSnapshot({
    nodes: snapshot.nodes,
    members: snapshot.members,
    structureType: snapshot.structureType,
  })
  loads.loadSnapshot(snapshot.loads)
  solver.result = null
  emit('close')
}

function exportJSON() {
  const snapshot: SessionSnapshot = {
    nodes: structure.nodes,
    members: structure.members,
    structureType: structure.structureType,
    loads: loads.loads,
    savedAt: new Date().toISOString(),
  }
  const json = JSON.stringify(snapshot, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `structure-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg shadow-lg max-w-lg w-full mx-4 max-h-96 flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
        <h2 class="font-semibold text-slate-800">Import Structure</h2>
        <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600">✕</button>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-slate-200 px-6">
        <button
          :class="['px-4 py-2 font-medium text-sm', activeTab === 'paste' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-800']"
          @click="activeTab = 'paste'"
        >
          Paste JSON
        </button>
        <button
          :class="['px-4 py-2 font-medium text-sm', activeTab === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-800']"
          @click="activeTab = 'upload'"
        >
          Upload File
        </button>
      </div>

      <!-- Content -->
      <div class="px-6 py-4 overflow-y-auto flex-1">
        <template v-if="activeTab === 'paste'">
          <textarea
            v-model="jsonText"
            placeholder="Paste JSON here..."
            class="w-full h-32 border border-slate-300 rounded font-mono text-xs p-2"
          />
        </template>
        <template v-else>
          <div class="border-2 border-dashed border-slate-300 rounded p-4 text-center">
            <input
              ref="fileInput"
              type="file"
              accept=".json"
              @change="handleFileUpload"
              class="hidden"
            />
            <button
              @click="fileInput?.click()"
              class="text-blue-600 hover:text-blue-700 font-medium"
            >
              Click to select file
            </button>
            <p class="text-xs text-slate-500 mt-1">or drag & drop JSON file</p>
          </div>
        </template>

        <!-- Error message -->
        <div v-if="error" class="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {{ error }}
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-200 flex justify-between gap-2">
        <button
          @click="exportJSON"
          class="px-4 py-2 text-sm text-slate-700 bg-slate-100 rounded hover:bg-slate-200"
        >
          Export Current
        </button>
        <div class="flex gap-2">
          <button
            @click="$emit('close')"
            class="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            @click="activeTab === 'paste' ? handlePaste() : null"
            :disabled="validating || !jsonText"
            :class="['px-4 py-2 text-sm rounded text-white', validating || !jsonText ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700']"
          >
            {{ validating ? 'Validating...' : 'Import' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
