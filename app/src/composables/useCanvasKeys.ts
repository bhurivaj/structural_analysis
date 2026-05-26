import { ref } from 'vue'
import type { SceneManager } from '@/components/canvas/three/SceneManager'
import { useStructureStore } from '@/stores/structureStore'
import { useCanvasTool } from '@/composables/useCanvasTool'
import { useCanvasViewport } from '@/composables/useCanvasViewport'
import { useUndoRedo } from '@/composables/useUndoRedo'

type KeysContext = {
  getScene: () => SceneManager | null
  onEscape: () => void
}

export function useCanvasKeys() {
  const structure = useStructureStore()
  const { setTool } = useCanvasTool()
  const { toggleSnap } = useCanvasViewport()
  const { undo, redo } = useUndoRedo()

  const isSpaceHeld = ref(false)
  let _ctx: KeysContext | null = null

  function handleKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    const key = e.key.toUpperCase()
    if (key === 'S') setTool('SELECT')
    if (key === 'P') setTool('PAN')
    if (key === 'N') setTool('ADD_NODE')
    if (key === 'M') setTool('ADD_MEMBER')
    if (key === 'L') setTool('ADD_POINT_LOAD')
    if (key === 'D') setTool('ADD_DIST_LOAD')
    if (key === 'R') setTool('ADD_MOMENT')
    if (key === 'G') toggleSnap()
    if (key === 'F') {
      const scene = _ctx?.getScene()
      if (scene) {
        const xs = structure.nodes.map(n => n.x), ys = structure.nodes.map(n => n.y)
        if (xs.length) scene.fitToView(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys))
      }
    }
    if (key === 'ESCAPE') _ctx?.onEscape()
    if (key === 'Z' && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); redo() }
    else if (key === 'Z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); undo() }
    else if (key === 'Y' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); redo() }
    if ((key === 'DELETE' || key === 'BACKSPACE') && document.activeElement === document.body) {
      e.preventDefault()
      ;[...structure.selectedNodeIds].forEach(id => structure.deleteNode(id))
      ;[...structure.selectedMemberIds].forEach(id => structure.deleteMember(id))
    }
    if (e.code === 'Space' && !e.repeat) { isSpaceHeld.value = true; setTool('PAN') }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') { isSpaceHeld.value = false; setTool('SELECT') }
  }

  function attach(ctx: KeysContext) {
    _ctx = ctx
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
  }

  function detach() {
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    _ctx = null
  }

  return { isSpaceHeld, attach, detach }
}
