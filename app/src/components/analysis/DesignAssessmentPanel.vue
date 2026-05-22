<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSolverStore } from '@/stores/solverStore'
import { useStructureStore } from '@/stores/structureStore'
import { useSteelProfileStore } from '@/stores/steelProfileStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { performDesignCheck, type DesignCheckResult } from '@/utils/designCheck'
import { findOptimalProfile } from '@/utils/autoSize'
import { useSessionCache } from '@/composables/useSessionCache'
import AlternativesRow from './AlternativesRow.vue'

const solver = useSolverStore()
const structure = useStructureStore()
const steelProfiles = useSteelProfileStore()
const settings = useSettingsStore()

const cache = useSessionCache()
const expandedMemberId = ref<string | null>(null)
const isSizing = ref(false)
const sizingMessage = ref('')

const membersMap = computed(() => new Map(structure.members.map(m => [m.id, m])))
const nodesMap = computed(() => new Map(structure.nodes.map(n => [n.id, n])))
const profilesMap = computed(() => new Map(steelProfiles.profiles.map(p => [p.id, p])))

const designResults = computed<DesignCheckResult[]>(() => {
  if (!solver.result?.success) return []
  return performDesignCheck(
    solver.result.memberResults,
    membersMap.value,
    nodesMap.value,
    profilesMap.value,
    settings.defaultFy,
    settings.urMarginal,
    settings.urFail,
  )
})

const passCount = computed(() => designResults.value.filter(r => r.status === 'PASS').length)
const totalCount = computed(() => designResults.value.length)
const failOrMarginalResults = computed(() =>
  designResults.value.filter(r => r.status === 'FAIL' || r.status === 'MARGINAL'),
)

function getStatusColor(status: string): string {
  if (status === 'PASS') return '#10b981'
  if (status === 'MARGINAL') return '#f59e0b'
  return '#ef4444'
}

function getStatusIcon(status: string): string {
  if (status === 'PASS') return '✓'
  if (status === 'MARGINAL') return '⚠'
  return '✗'
}

function toggleExpanded(memberId: string) {
  expandedMemberId.value = expandedMemberId.value === memberId ? null : memberId
}

function applyProfile(memberId: string, profileId: string) {
  const profile = steelProfiles.profileById(profileId)
  if (!profile) return
  structure.updateMember(memberId, {
    steelProfileId: profile.id,
    E: profile.E,
    A: profile.A,
    I: profile.Ix,
  })
  expandedMemberId.value = null
  cache.saveSession()
}

async function autoSizeAll() {
  if (!solver.result?.success) return
  isSizing.value = true
  sizingMessage.value = ''

  const memberResults = solver.result.memberResults
  let changeCount = 0

  for (const result of failOrMarginalResults.value) {
    const mr = memberResults.find(r => r.memberId === result.memberId)
    const member = membersMap.value.get(result.memberId)
    if (!mr || !member) continue

    const optimal = findOptimalProfile(
      mr,
      member,
      nodesMap.value,
      steelProfiles.profiles,
      settings.defaultFy,
      settings.urMarginal,
      settings.urFail,
    )

    if (optimal) {
      structure.updateMember(result.memberId, {
        steelProfileId: optimal.id,
        E: optimal.E,
        A: optimal.A,
        I: optimal.Ix,
      })
      changeCount++
    }
  }

  isSizing.value = false
  sizingMessage.value =
    changeCount > 0
      ? `Updated ${changeCount} member${changeCount > 1 ? 's' : ''} — re-run analysis to verify.`
      : 'No suitable profiles found for failing members.'
  if (changeCount > 0) cache.saveSession()
}

function currentProfileClass(result: DesignCheckResult): string | undefined {
  const member = membersMap.value.get(result.memberId)
  if (!member?.steelProfileId) return undefined
  return steelProfiles.profileById(member.steelProfileId)?.profileClass
}
</script>

<template>
  <div v-if="designResults.length > 0" class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="text-sm font-medium text-slate-700">
        Design Assessment
        <span class="ml-2 text-xs text-slate-600">({{ passCount }}/{{ totalCount }} members pass)</span>
      </div>
      <button
        v-if="failOrMarginalResults.length > 0"
        :disabled="isSizing"
        class="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 disabled:opacity-50 font-medium"
        @click="autoSizeAll"
      >
        ⚡ Auto-size All
      </button>
    </div>

    <p v-if="sizingMessage" class="text-xs px-2 py-1 rounded"
      :class="sizingMessage.startsWith('Updated') ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'">
      {{ sizingMessage }}
    </p>

    <table class="w-full text-xs border-collapse">
      <thead class="bg-slate-100">
        <tr>
          <th class="px-2 py-1 text-left text-slate-600">Member</th>
          <th class="px-2 py-1 text-right text-slate-600">Profile</th>
          <th class="px-2 py-1 text-right text-slate-600">UR_axial</th>
          <th class="px-2 py-1 text-right text-slate-600">UR_bending</th>
          <th class="px-2 py-1 text-right text-slate-600">UR_shear</th>
          <th class="px-2 py-1 text-right text-slate-600">UR_combined</th>
          <th class="px-2 py-1 text-center text-slate-600">Status</th>
          <th class="px-2 py-1 text-left text-slate-600">Suggestion</th>
          <th class="px-2 py-1 text-center text-slate-600">Alt</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="result in designResults" :key="result.memberId">
          <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="px-2 py-1 font-medium">{{ result.memberLabel }}</td>
            <td class="px-2 py-1 text-right text-slate-600">{{ result.profileName ?? 'Manual' }}</td>
            <td class="px-2 py-1 text-right font-mono" :style="{ color: result.UR_axial > 1 ? '#ef4444' : '#10b981' }">
              {{ result.UR_axial.toFixed(3) }}
            </td>
            <td class="px-2 py-1 text-right font-mono" :style="{ color: result.UR_bending > 1 ? '#ef4444' : '#10b981' }">
              {{ result.UR_bending.toFixed(3) }}
            </td>
            <td class="px-2 py-1 text-right font-mono" :style="{ color: result.UR_shear > 1 ? '#ef4444' : '#10b981' }">
              {{ result.UR_shear.toFixed(3) }}
            </td>
            <td class="px-2 py-1 text-right font-mono font-medium" :style="{ color: getStatusColor(result.status) }">
              {{ result.UR_combined.toFixed(3) }}
            </td>
            <td class="px-2 py-1 text-center font-bold" :style="{ color: getStatusColor(result.status) }">
              {{ getStatusIcon(result.status) }} {{ result.status }}
            </td>
            <td class="px-2 py-1 text-slate-600">{{ result.suggestion }}</td>
            <td class="px-2 py-1 text-center">
              <button
                class="text-slate-400 hover:text-slate-700 transition-transform"
                :class="{ 'rotate-180': expandedMemberId === result.memberId }"
                @click="toggleExpanded(result.memberId)"
              >
                ▼
              </button>
            </td>
          </tr>
          <tr v-if="expandedMemberId === result.memberId">
            <td colspan="9" class="p-0">
              <AlternativesRow
                :member-result="solver.result!.memberResults.find(r => r.memberId === result.memberId)!"
                :member="membersMap.get(result.memberId)!"
                :nodes="nodesMap"
                :profiles="steelProfiles.profiles"
                :default-fy="settings.defaultFy"
                :ur-marginal="settings.urMarginal"
                :ur-fail="settings.urFail"
                :current-profile-class="currentProfileClass(result)"
                @apply="profileId => applyProfile(result.memberId, profileId)"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
