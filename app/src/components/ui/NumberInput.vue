<script setup lang="ts">
interface Props {
  modelValue: number
  label?: string
  unit?: string
  step?: number
  min?: number
  max?: number
}

const props = withDefaults(defineProps<Props>(), { step: 0.1 })
const emit = defineEmits<{ (e: 'update:modelValue', v: number): void }>()

function onInput(event: Event) {
  const val = parseFloat((event.target as HTMLInputElement).value)
  if (!isNaN(val)) emit('update:modelValue', val)
}
</script>

<template>
  <label class="flex flex-col gap-0.5">
    <span v-if="label" class="text-xs text-slate-500">{{ label }}</span>
    <div class="flex items-center gap-1">
      <input
        type="number"
        :value="modelValue"
        :step="step"
        :min="min"
        :max="max"
        class="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        @input="onInput"
      />
      <span v-if="unit" class="text-xs text-slate-400 whitespace-nowrap">{{ unit }}</span>
    </div>
  </label>
</template>
