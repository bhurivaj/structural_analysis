import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Load, PointLoad, DistributedLoad, MomentLoad } from '@/types/loads'
import { generateId } from '@/utils/idGen'
import { useStructureStore } from './structureStore'
import { useSteelProfileStore } from './steelProfileStore'

export const useLoadsStore = defineStore('loads', () => {
  const loads = ref<Load[]>([])

  const pointLoads = computed(() => loads.value.filter((l): l is PointLoad => l.type === 'point_load'))
  const distributedLoads = computed(() => loads.value.filter((l): l is DistributedLoad => l.type === 'distributed_load'))
  const momentLoads = computed(() => loads.value.filter((l): l is MomentLoad => l.type === 'moment'))
  const loadsByNode = computed(() => (nodeId: string) => loads.value.filter(l => l.type !== 'distributed_load' && (l as PointLoad | MomentLoad).nodeId === nodeId))
  const loadsByMember = computed(() => (memberId: string) => loads.value.filter(l => l.type === 'distributed_load' && (l as DistributedLoad).memberId === memberId))

  function addPointLoad(data: Omit<PointLoad, 'id' | 'type'>): PointLoad {
    const label = `PL${loads.value.filter(l => l.type === 'point_load').length + 1}`
    const load: PointLoad = { id: generateId(), type: 'point_load', label, ...data }
    loads.value.push(load)
    return load
  }

  function addDistributedLoad(data: Omit<DistributedLoad, 'id' | 'type'>): DistributedLoad {
    const label = `DL${loads.value.filter(l => l.type === 'distributed_load').length + 1}`
    const load: DistributedLoad = { id: generateId(), type: 'distributed_load', label, ...data }
    loads.value.push(load)
    return load
  }

  function addMomentLoad(data: Omit<MomentLoad, 'id' | 'type'>): MomentLoad | null {
    const structure = useStructureStore()
    if (structure.structureType === 'truss') return null
    const label = `ML${loads.value.filter(l => l.type === 'moment').length + 1}`
    const load: MomentLoad = { id: generateId(), type: 'moment', label, ...data }
    loads.value.push(load)
    return load
  }

  function removeMomentLoads(): number {
    const count = loads.value.filter(l => l.type === 'moment').length
    loads.value = loads.value.filter(l => l.type !== 'moment')
    return count
  }

  function removeLoadsForNode(nodeId: string) {
    loads.value = loads.value.filter(
      l => l.type === 'distributed_load' || (l as PointLoad | MomentLoad).nodeId !== nodeId
    )
  }

  function removeLoadsForMember(memberId: string) {
    loads.value = loads.value.filter(
      l => l.type !== 'distributed_load' || (l as DistributedLoad).memberId !== memberId
    )
  }

  function updateLoad(id: string, data: Partial<Load>) {
    const idx = loads.value.findIndex(l => l.id === id)
    if (idx >= 0) Object.assign(loads.value[idx], data)
  }

  function deleteLoad(id: string) {
    loads.value = loads.value.filter(l => l.id !== id)
  }

  function clearLoads() {
    loads.value = []
  }

  function loadSnapshot(data: Load[]) {
    loads.value = [...data]
  }

  function generateSelfWeight(): number {
    const structureStore = useStructureStore()
    const profileStore = useSteelProfileStore()

    loads.value = loads.value.filter(
      l => !(l.type === 'distributed_load' && (l as DistributedLoad).isSelfWeight),
    )

    let count = 0
    for (const member of structureStore.members) {
      if (!member.steelProfileId) continue
      const profile = profileStore.profileById(member.steelProfileId)
      if (!profile) continue

      const w = profile.mass * 9.81 / 1000  // kg/m → kN/m (downward = negative)
      const load: DistributedLoad = {
        id: generateId(),
        type: 'distributed_load',
        label: `SW-${member.label ?? member.id.slice(0, 6)}`,
        memberId: member.id,
        w1: -w,
        w2: -w,
        direction: 'global_y',
        loadCase: 'D',
        isSelfWeight: true,
      }
      loads.value.push(load)
      count++
    }
    return count
  }

  return {
    loads,
    pointLoads,
    distributedLoads,
    momentLoads,
    loadsByNode,
    loadsByMember,
    addPointLoad,
    addDistributedLoad,
    addMomentLoad,
    removeMomentLoads,
    removeLoadsForNode,
    removeLoadsForMember,
    updateLoad,
    deleteLoad,
    clearLoads,
    loadSnapshot,
    generateSelfWeight,
  }
})
