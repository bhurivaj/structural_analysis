<script setup lang="ts">
import type { SteelProfile } from '@/types/steel'

defineProps<{ profile: SteelProfile | null }>()
</script>

<template>
  <div v-if="profile" class="p-4 space-y-3">
    <div class="font-semibold text-slate-800">{{ profile.designation }}</div>
    <div class="text-xs text-slate-500">{{ profile.standard }} · {{ profile.profileClass }}-section</div>

    <!-- SVG cross-section sketch per profile class -->
    <svg viewBox="-60 -80 120 160" class="w-32 h-32 mx-auto">
      <!-- H / I section: top flange + web + bottom flange -->
      <template v-if="profile.profileClass === 'H' || profile.profileClass === 'I'">
        <rect :x="-profile.bf/4" :y="-profile.d/4" :width="profile.bf/2" :height="profile.tf/2" fill="#94a3b8" />
        <rect :x="-profile.tw/4" :y="-profile.d/4 + profile.tf/2" :width="profile.tw/2" :height="(profile.d - 2*profile.tf)/2" fill="#94a3b8" />
        <rect :x="-profile.bf/4" :y="profile.d/4 - profile.tf/2" :width="profile.bf/2" :height="profile.tf/2" fill="#94a3b8" />
      </template>

      <!-- C section: web + top flange + bottom flange on one side -->
      <template v-else-if="profile.profileClass === 'C'">
        <rect :x="-profile.tw/4" :y="-profile.d/4" :width="profile.tw/2" :height="profile.d/2" fill="#94a3b8" />
        <rect :x="-profile.tw/4" :y="-profile.d/4" :width="profile.bf/2" :height="profile.tf/2" fill="#94a3b8" />
        <rect :x="-profile.tw/4" :y="profile.d/4 - profile.tf/2" :width="profile.bf/2" :height="profile.tf/2" fill="#94a3b8" />
      </template>

      <!-- L section: two legs at 90° -->
      <template v-else-if="profile.profileClass === 'L'">
        <rect :x="-profile.d/4" :y="-profile.d/4" :width="profile.tf/2" :height="profile.d/2" fill="#94a3b8" />
        <rect :x="-profile.d/4" :y="profile.d/4 - profile.tf/2" :width="profile.bf/2" :height="profile.tf/2" fill="#94a3b8" />
      </template>

      <!-- RHS section: hollow rectangle -->
      <template v-else-if="profile.profileClass === 'RHS'">
        <rect :x="-profile.bf/4" :y="-profile.d/4" :width="profile.bf/2" :height="profile.d/2" fill="#94a3b8" />
        <rect :x="-profile.bf/4 + profile.tw/2" :y="-profile.d/4 + profile.tf/2"
              :width="profile.bf/2 - profile.tw" :height="profile.d/2 - profile.tf" fill="white" />
      </template>

      <!-- CHS section: hollow square -->
      <template v-else-if="profile.profileClass === 'CHS'">
        <rect :x="-profile.d/4" :y="-profile.d/4" :width="profile.d/2" :height="profile.d/2" fill="#94a3b8" />
        <rect :x="-profile.d/4 + profile.tw/2" :y="-profile.d/4 + profile.tw/2"
              :width="profile.d/2 - profile.tw" :height="profile.d/2 - profile.tw" fill="white" />
      </template>

      <!-- RoundPipe section: hollow circle -->
      <template v-else-if="profile.profileClass === 'RoundPipe'">
        <circle cx="0" cy="0" :r="profile.d/4" fill="#94a3b8" />
        <circle cx="0" cy="0" :r="profile.d/4 - profile.tf/2" fill="white" />
      </template>

      <!-- WideFlange section: same as H/I -->
      <template v-else-if="profile.profileClass === 'WideFlange'">
        <rect :x="-profile.bf/4" :y="-profile.d/4" :width="profile.bf/2" :height="profile.tf/2" fill="#94a3b8" />
        <rect :x="-profile.tw/4" :y="-profile.d/4 + profile.tf/2" :width="profile.tw/2" :height="(profile.d - 2*profile.tf)/2" fill="#94a3b8" />
        <rect :x="-profile.bf/4" :y="profile.d/4 - profile.tf/2" :width="profile.bf/2" :height="profile.tf/2" fill="#94a3b8" />
      </template>

      <!-- LightLipChannel section: C shape with return lips -->
      <template v-else-if="profile.profileClass === 'LightLipChannel'">
        <rect :x="-profile.tw/4" :y="-profile.d/4" :width="profile.tw/2" :height="profile.d/2" fill="#94a3b8" />
        <rect :x="-profile.tw/4" :y="-profile.d/4" :width="profile.bf/2" :height="profile.tf/2" fill="#94a3b8" />
        <rect :x="-profile.tw/4" :y="profile.d/4 - profile.tf/2" :width="profile.bf/2" :height="profile.tf/2" fill="#94a3b8" />
        <rect :x="-profile.tw/4 + profile.bf/2 - profile.tf/2" :y="-profile.d/4" :width="profile.tf/2" :height="profile.d/8" fill="#94a3b8" />
        <rect :x="-profile.tw/4 + profile.bf/2 - profile.tf/2" :y="profile.d/4 - profile.d/8" :width="profile.tf/2" :height="profile.d/8" fill="#94a3b8" />
      </template>
    </svg>

    <table class="w-full text-xs">
      <tbody class="divide-y divide-slate-100">
        <tr v-for="[label, val] in [
          ['d', `${profile.d} mm`],
          ['bf', `${profile.bf} mm`],
          ['tf', `${profile.tf} mm`],
          ['tw', `${profile.tw} mm`],
          ['A', `${profile.A.toLocaleString()} mm²`],
          ['Ix', `${(profile.Ix/1e6).toFixed(1)} ×10⁶ mm⁴`],
          ['Iy', `${(profile.Iy/1e6).toFixed(1)} ×10⁶ mm⁴`],
          ['Sx', `${(profile.Sx/1e3).toFixed(0)} ×10³ mm³`],
          ['rx', `${profile.rx} mm`],
          ['mass', `${profile.mass} kg/m`],
          ['Fy', `${profile.Fy} MPa`],
        ]" :key="label" class="hover:bg-slate-50">
          <td class="py-0.5 text-slate-500 w-12">{{ label }}</td>
          <td class="py-0.5 text-slate-700 font-mono">{{ val }}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else class="p-4 text-sm text-slate-400 text-center">
    Select a profile to view details.
  </div>
</template>
