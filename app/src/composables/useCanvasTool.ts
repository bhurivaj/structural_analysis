import { ref } from 'vue'

export type CanvasTool = 'SELECT' | 'ADD_NODE' | 'ADD_MEMBER' | 'ADD_POINT_LOAD' | 'ADD_DIST_LOAD' | 'ADD_MOMENT' | 'PAN'

const activeTool = ref<CanvasTool>('SELECT')
const pendingLoadNodeId = ref<string | null>(null)
const pendingLoadMemberId = ref<string | null>(null)
const editingLoadId = ref<string | null>(null)

export function useCanvasTool() {
  function setTool(tool: CanvasTool) {
    activeTool.value = tool
    if (!['ADD_POINT_LOAD', 'ADD_DIST_LOAD', 'ADD_MOMENT'].includes(tool)) {
      pendingLoadNodeId.value = null
      pendingLoadMemberId.value = null
      editingLoadId.value = null
    }
  }

  function setPendingLoadTarget(nodeId?: string | null, memberId?: string | null) {
    pendingLoadNodeId.value = nodeId ?? null
    pendingLoadMemberId.value = memberId ?? null
    editingLoadId.value = null
  }

  function setEditingLoad(id: string | null) {
    editingLoadId.value = id
  }

  return {
    activeTool, setTool,
    pendingLoadNodeId, pendingLoadMemberId, editingLoadId,
    setPendingLoadTarget, setEditingLoad,
  }
}
