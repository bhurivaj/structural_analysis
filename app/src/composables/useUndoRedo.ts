import { ref, computed, watch, nextTick } from 'vue'
import { useStructureStore } from '@/stores/structureStore'
import { useLoadsStore } from '@/stores/loadsStore'
import type { StructureNode, Member, StructureType } from '@/types/structure'
import type { Load } from '@/types/loads'

interface UndoSnapshot {
  nodes: StructureNode[]
  members: Member[]
  structureType: StructureType
  loads: Load[]
}

const past = ref<UndoSnapshot[]>([])
const future = ref<UndoSnapshot[]>([])
let _prev: UndoSnapshot | null = null
let _isRestoring = false
let _timer: ReturnType<typeof setTimeout>
let _watchSetUp = false
const MAX_STACK = 50

function _capture(): UndoSnapshot {
  const s = useStructureStore()
  const l = useLoadsStore()
  return {
    nodes: JSON.parse(JSON.stringify(s.nodes)),
    members: JSON.parse(JSON.stringify(s.members)),
    structureType: s.structureType,
    loads: JSON.parse(JSON.stringify(l.loads)),
  }
}

function _restore(snap: UndoSnapshot) {
  const s = useStructureStore()
  const l = useLoadsStore()
  _isRestoring = true
  s.loadSnapshot(snap)
  l.loadSnapshot(snap.loads)
  nextTick(() => { _isRestoring = false })
}

export function useUndoRedo() {
  const structure = useStructureStore()
  const loads = useLoadsStore()

  // Initialize _prev on first composable call
  if (_prev === null) _prev = _capture()

  // Set up the watch exactly once (guard with flag)
  if (!_watchSetUp) {
    _watchSetUp = true
    watch(
      [() => structure.nodes, () => structure.members, () => structure.structureType, () => loads.loads],
      () => {
        if (_isRestoring) return
        clearTimeout(_timer)
        _timer = setTimeout(() => {
          if (_prev !== null) {
            past.value.push(_prev)
            if (past.value.length > MAX_STACK) past.value.shift()
          }
          future.value = []
          _prev = _capture()
        }, 300)
      },
      { deep: true },
    )
  }

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function undo() {
    if (!past.value.length) return
    clearTimeout(_timer)
    future.value.push(_capture())
    const prev = past.value.pop()!
    _restore(prev)
    _prev = _capture()
  }

  function redo() {
    if (!future.value.length) return
    clearTimeout(_timer)
    past.value.push(_capture())
    const next = future.value.pop()!
    _restore(next)
    _prev = _capture()
  }

  return { canUndo, canRedo, undo, redo }
}
