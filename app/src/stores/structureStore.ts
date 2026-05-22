import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { StructureNode, Member, StructureType } from '@/types/structure'
import { generateId } from '@/utils/idGen'
import { useLoadsStore } from './loadsStore'

export const useStructureStore = defineStore('structure', () => {
  const nodes = ref<StructureNode[]>([])
  const members = ref<Member[]>([])
  const structureType = ref<StructureType>('frame')
  const selectedNodeIds = ref<string[]>([])
  const selectedMemberIds = ref<string[]>([])
  const pendingMemberStartNodeId = ref<string | null>(null)

  const nodeById = computed(() => (id: string) => nodes.value.find(n => n.id === id))
  const memberById = computed(() => (id: string) => members.value.find(m => m.id === id))
  const connectedMembers = computed(
    () => (nodeId: string) => members.value.filter(m => m.startNodeId === nodeId || m.endNodeId === nodeId),
  )

  function addNode(data: Omit<StructureNode, 'id'>): StructureNode {
    const node: StructureNode = { id: generateId(), label: `N${nodes.value.length + 1}`, ...data }
    nodes.value.push(node)
    return node
  }

  function updateNode(id: string, data: Partial<Omit<StructureNode, 'id'>>) {
    const node = nodes.value.find(n => n.id === id)
    if (node) Object.assign(node, data)
  }

  function deleteNode(id: string) {
    const connectedMemberIds = members.value
      .filter(m => m.startNodeId === id || m.endNodeId === id)
      .map(m => m.id)

    nodes.value = nodes.value.filter(n => n.id !== id)
    members.value = members.value.filter(m => m.startNodeId !== id && m.endNodeId !== id)
    selectedNodeIds.value = selectedNodeIds.value.filter(sid => sid !== id)

    const loadsStore = useLoadsStore()
    loadsStore.removeLoadsForNode(id)
    connectedMemberIds.forEach(mid => loadsStore.removeLoadsForMember(mid))
  }

  function addMember(data: Omit<Member, 'id'>): Member {
    const member: Member = { id: generateId(), label: `M${members.value.length + 1}`, ...data }
    members.value.push(member)
    return member
  }

  function updateMember(id: string, data: Partial<Omit<Member, 'id'>>) {
    const member = members.value.find(m => m.id === id)
    if (member) Object.assign(member, data)
  }

  function deleteMember(id: string) {
    members.value = members.value.filter(m => m.id !== id)
    selectedMemberIds.value = selectedMemberIds.value.filter(sid => sid !== id)

    const loadsStore = useLoadsStore()
    loadsStore.removeLoadsForMember(id)
  }

  function selectNode(id: string, multi = false) {
    if (multi) {
      const idx = selectedNodeIds.value.indexOf(id)
      if (idx >= 0) selectedNodeIds.value.splice(idx, 1)
      else selectedNodeIds.value.push(id)
    } else {
      selectedNodeIds.value = [id]
      selectedMemberIds.value = []
    }
  }

  function selectMember(id: string, multi = false) {
    if (multi) {
      const idx = selectedMemberIds.value.indexOf(id)
      if (idx >= 0) selectedMemberIds.value.splice(idx, 1)
      else selectedMemberIds.value.push(id)
    } else {
      selectedMemberIds.value = [id]
      selectedNodeIds.value = []
    }
  }

  function clearSelection() {
    selectedNodeIds.value = []
    selectedMemberIds.value = []
    pendingMemberStartNodeId.value = null
  }

  function setStructureType(type: StructureType): number {
    structureType.value = type
    members.value.forEach(m => {
      m.isTruss = type === 'truss'
      if (type === 'truss') m.I = 0
    })
    if (type === 'truss') {
      const loadsStore = useLoadsStore()
      return loadsStore.removeMomentLoads()
    }
    return 0
  }

  function clearAll() {
    nodes.value = []
    members.value = []
    selectedNodeIds.value = []
    selectedMemberIds.value = []
    pendingMemberStartNodeId.value = null
  }

  function loadSnapshot(data: { nodes: StructureNode[]; members: Member[]; structureType: StructureType }) {
    nodes.value = [...data.nodes]
    members.value = [...data.members]
    structureType.value = data.structureType
    selectedNodeIds.value = []
    selectedMemberIds.value = []
    pendingMemberStartNodeId.value = null
  }

  return {
    nodes,
    members,
    structureType,
    selectedNodeIds,
    selectedMemberIds,
    pendingMemberStartNodeId,
    nodeById,
    memberById,
    connectedMembers,
    addNode,
    updateNode,
    deleteNode,
    addMember,
    updateMember,
    deleteMember,
    selectNode,
    selectMember,
    clearSelection,
    setStructureType,
    clearAll,
    loadSnapshot,
  }
})
