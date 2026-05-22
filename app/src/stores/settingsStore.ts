import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type ForceUnit = 'kN' | 'N' | 'tf'
export type LengthUnit = 'm' | 'cm' | 'mm' | 'ft'
export type StressUnit = 'MPa' | 'kPa' | 'tf/cm²' | 'ksc'

export const useSettingsStore = defineStore('settings', () => {
  const projectName = ref('')
  const engineerName = ref('')
  const forceUnit = ref<ForceUnit>('kN')
  const lengthUnit = ref<LengthUnit>('m')
  const stressUnit = ref<StressUnit>('MPa')
  const defaultE = ref(200000)
  const defaultFy = ref(250)
  const defaultA = ref(6353)
  const defaultI = ref(47200000)
  const deformedScale = ref(1000)
  const urMarginal = ref(0.8)
  const urFail = ref(1.0)

  function toForce(kN: number): number {
    if (forceUnit.value === 'N') return kN * 1000
    if (forceUnit.value === 'tf') return kN / 9.80665
    return kN
  }

  function toLength(m: number): number {
    if (lengthUnit.value === 'cm') return m * 100
    if (lengthUnit.value === 'mm') return m * 1000
    if (lengthUnit.value === 'ft') return m * 3.28084
    return m
  }

  function toStress(mpa: number): number {
    if (stressUnit.value === 'kPa') return mpa * 1000
    if (stressUnit.value === 'tf/cm²') return mpa / 98.0665
    if (stressUnit.value === 'ksc') return mpa * 10.197
    return mpa
  }

  function toMoment(kNm: number): number {
    return toForce(kNm) * toLength(1)
  }

  function fromForce(v: number): number {
    if (forceUnit.value === 'N') return v / 1000
    if (forceUnit.value === 'tf') return v * 9.80665
    return v
  }

  function fromLength(v: number): number {
    if (lengthUnit.value === 'cm') return v / 100
    if (lengthUnit.value === 'mm') return v / 1000
    if (lengthUnit.value === 'ft') return v / 3.28084
    return v
  }

  const momentLabel = computed(() => `${forceUnit.value}·${lengthUnit.value}`)
  const distForceLabel = computed(() => `${forceUnit.value}/${lengthUnit.value}`)

  const unitDisplay = computed(() => `${forceUnit.value}, ${lengthUnit.value}, ${stressUnit.value}`)

  function save() {
    const data = {
      projectName: projectName.value,
      engineerName: engineerName.value,
      forceUnit: forceUnit.value,
      lengthUnit: lengthUnit.value,
      stressUnit: stressUnit.value,
      defaultE: defaultE.value,
      defaultFy: defaultFy.value,
      defaultA: defaultA.value,
      defaultI: defaultI.value,
      deformedScale: deformedScale.value,
      urMarginal: urMarginal.value,
      urFail: urFail.value,
    }
    localStorage.setItem('structcalc_settings', JSON.stringify(data))
  }

  function load() {
    try {
      const raw = localStorage.getItem('structcalc_settings')
      if (!raw) return
      const data = JSON.parse(raw)
      if (data.projectName) projectName.value = data.projectName
      if (data.engineerName) engineerName.value = data.engineerName
      if (data.forceUnit) forceUnit.value = data.forceUnit
      if (data.lengthUnit) lengthUnit.value = data.lengthUnit
      if (data.stressUnit) stressUnit.value = data.stressUnit
      if (data.defaultE) defaultE.value = data.defaultE
      if (data.defaultFy) defaultFy.value = data.defaultFy
      if (data.defaultA) defaultA.value = data.defaultA
      if (data.defaultI) defaultI.value = data.defaultI
      if (data.deformedScale) deformedScale.value = data.deformedScale
      if (data.urMarginal != null) urMarginal.value = data.urMarginal
      if (data.urFail != null) urFail.value = data.urFail
    } catch {
      // ignore parse errors
    }
  }

  return {
    projectName,
    engineerName,
    forceUnit,
    lengthUnit,
    stressUnit,
    defaultE,
    defaultFy,
    defaultA,
    defaultI,
    deformedScale,
    urMarginal,
    urFail,
    momentLabel,
    distForceLabel,
    unitDisplay,
    toForce,
    toLength,
    toStress,
    toMoment,
    fromForce,
    fromLength,
    save,
    load,
  }
})
