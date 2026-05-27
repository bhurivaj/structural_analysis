<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStructureStore } from '@/stores/structureStore'
import { useSteelProfileStore } from '@/stores/steelProfileStore'
import { memberPropsFromProfile } from '@/utils/memberProps'
import NumberInput from '@/components/ui/NumberInput.vue'

const structure = useStructureStore()
const profileStore = useSteelProfileStore()

const selectedCount = computed(() => structure.selectedMemberIds.length)
const bulkProfileId = ref('')

const selectedMember = computed(() => {
  if (structure.selectedMemberIds.length !== 1) return null
  return structure.memberById(structure.selectedMemberIds[0]) ?? null
})

const assignedProfile = computed(() => {
  if (!selectedMember.value?.steelProfileId) return null
  return profileStore.profileById(selectedMember.value.steelProfileId) ?? null
})

function update(field: string, value: unknown) {
  if (!selectedMember.value) return
  structure.updateMember(selectedMember.value.id, { [field]: value })
}

function assignProfile(profileId: string) {
  if (!selectedMember.value) return
  const profile = profileStore.profileById(profileId)
  if (!profile) return
  structure.updateMember(selectedMember.value.id, memberPropsFromProfile(profile))
}

function applyBulkProfile() {
  if (!bulkProfileId.value) return
  const profile = profileStore.profileById(bulkProfileId.value)
  if (!profile) return
  for (const id of structure.selectedMemberIds) {
    structure.updateMember(id, memberPropsFromProfile(profile))
  }
}

function clearBulkProfiles() {
  for (const id of structure.selectedMemberIds) {
    structure.updateMember(id, { steelProfileId: null })
  }
}

function deleteSelected() {
  const ids = [...structure.selectedMemberIds]
  for (const id of ids) {
    structure.deleteMember(id)
  }
}

function deleteMember() {
  if (!selectedMember.value) return
  structure.deleteMember(selectedMember.value.id)
}
</script>

<template>
  <div v-if="selectedCount > 1" class="p-3 space-y-3">
    <div class="font-medium text-sm text-slate-700">{{ selectedCount }} Members Selected</div>
    <label class="flex flex-col gap-0.5">
      <span class="text-xs text-slate-500">Assign Profile to All</span>
      <select v-model="bulkProfileId" class="px-2 py-1 text-sm border border-slate-300 rounded">
        <option value="">— Choose profile —</option>
        <option v-for="p in profileStore.profiles" :key="p.id" :value="p.id">{{ p.designation }}</option>
      </select>
    </label>
    <button
      :disabled="!bulkProfileId"
      class="w-full py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-40"
      @click="applyBulkProfile"
    >
      Apply to {{ selectedCount }} Members
    </button>
    <button
      class="w-full py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
      @click="clearBulkProfiles"
    >
      Remove Profile from All
    </button>
    <button
      class="w-full py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
      @click="deleteSelected"
    >
      Delete {{ selectedCount }} Members
    </button>
  </div>

  <div v-else-if="selectedMember" class="p-3 space-y-3">
    <div class="font-medium text-sm text-slate-700">Member {{ selectedMember.label || selectedMember.id.slice(0, 6) }}</div>
    <div class="text-xs text-slate-500">
      {{ structure.nodeById(selectedMember.startNodeId)?.label || selectedMember.startNodeId.slice(0, 4) }}
      →
      {{ structure.nodeById(selectedMember.endNodeId)?.label || selectedMember.endNodeId.slice(0, 4) }}
    </div>

    <label class="flex flex-col gap-0.5">
      <span class="text-xs text-slate-500">Label</span>
      <input
        type="text"
        :value="selectedMember.label"
        class="px-2 py-1 text-sm border border-slate-300 rounded font-medium"
        @change="e => update('label', (e.target as HTMLInputElement).value.trim() || selectedMember!.label)"
      />
    </label>

    <label class="flex items-center gap-2">
      <input
        type="checkbox"
        :checked="selectedMember.tensionOnly ?? false"
        @change="e => update('tensionOnly', (e.target as HTMLInputElement).checked)"
      />
      <span class="text-xs text-slate-600">Tension-only (cable/rod/sling)</span>
    </label>
    <p v-if="selectedMember.tensionOnly" class="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
      Member รับได้เฉพาะแรงดึง — หากเกิดแรงกดจะถูกถอดออกจาก solver อัตโนมัติ
    </p>

    <label class="flex flex-col gap-0.5">
      <span class="text-xs text-slate-500">Steel Profile</span>
      <select
        :value="selectedMember.steelProfileId ?? ''"
        class="px-2 py-1 text-sm border border-slate-300 rounded"
        @change="e => assignProfile((e.target as HTMLSelectElement).value)"
      >
        <option value="">— Manual input —</option>
        <option v-for="p in profileStore.profiles" :key="p.id" :value="p.id">
          {{ p.designation }} ({{ p.standard }})
        </option>
      </select>
    </label>

    <div v-if="assignedProfile" class="bg-slate-50 rounded p-2 text-xs text-slate-600 space-y-0.5">
      <div>A = {{ assignedProfile.A.toLocaleString() }} mm²</div>
      <div>Ix = {{ (assignedProfile.Ix / 1e6).toFixed(2) }} ×10⁶ mm⁴</div>
      <div>Mass = {{ assignedProfile.mass }} kg/m</div>
    </div>

    <NumberInput label="E (manual)" unit="MPa" :step="1000" :model-value="selectedMember.E" @update:model-value="v => update('E', v)" />
    <NumberInput label="A (manual)" unit="mm²" :model-value="selectedMember.A" @update:model-value="v => update('A', v)" />
    <NumberInput label="I (manual)" unit="mm⁴" :step="100000" :model-value="selectedMember.I" @update:model-value="v => update('I', v)" />

    <button class="w-full py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200" @click="deleteMember">
      Delete Member
    </button>
  </div>

  <div v-else class="p-3 text-sm text-slate-400">
    No member selected.
  </div>
</template>
