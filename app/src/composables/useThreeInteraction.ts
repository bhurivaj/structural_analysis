import { ref, computed } from 'vue'
import type { SceneManager } from '@/components/canvas/three/SceneManager'
import type { StructureRenderer } from '@/components/canvas/three/StructureRenderer'
import { useStructureStore } from '@/stores/structureStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCanvasTool } from '@/composables/useCanvasTool'
import { useCanvasViewport } from '@/composables/useCanvasViewport'
import { useUndoRedo } from '@/composables/useUndoRedo'
import { useCanvasMode } from '@/composables/useCanvasMode'
import { clientToWorld, projectToScreen, hitNode, hitMember, segIntersectsRect } from '@/composables/threeHitTest'

export type SelectionRect = { x: number; y: number; w: number; h: number }

let _scene: SceneManager | null = null
let _rend: StructureRenderer | null = null
let _canvas: HTMLElement | null = null

export function useThreeInteraction() {
  const structure = useStructureStore()
  const settings = useSettingsStore()
  const { activeTool, setTool, setPendingLoadTarget } = useCanvasTool()
  const { snapPoint, toggleSnap } = useCanvasViewport()
  const { undo, redo } = useUndoRedo()
  const { cameraMode } = useCanvasMode()

  const selectionRect = ref<SelectionRect | null>(null)
  const selectionMode = ref<'window' | 'crossing' | null>(null)
  const isSpaceHeld = ref(false)

  let _selStart: { cx: number; cy: number } | null = null
  let _selDragging = false
  let _emptyClick3d: { cx: number; cy: number } | null = null
  let _nodeDrag: { nodeId: string; startWx: number; startWy: number; origX: number; origY: number } | null = null
  let _epDrag: { endpoint: 'start' | 'end'; memberId: string } | null = null
  let _epSnapId: string | null = null
  let _mouseWorld: { x: number; y: number; z: number } | null = null

  const singleSelectedMember = computed(() =>
    structure.selectedMemberIds.length === 1
      ? structure.memberById(structure.selectedMemberIds[0]) ?? null
      : null
  )

  function toWorld(e: MouseEvent, planeZ = 0) {
    return _scene && _canvas ? clientToWorld(e.clientX, e.clientY, _scene, _canvas, planeZ) : null
  }

  function hitEp(clientX: number, clientY: number) {
    if (!_scene || !_canvas) return null
    const m = singleSelectedMember.value
    if (!m) return null
    const cr = _canvas.getBoundingClientRect()
    for (const ep of ['start', 'end'] as const) {
      const n = structure.nodeById(ep === 'start' ? m.startNodeId : m.endNodeId)
      if (!n) continue
      const { sx, sy } = projectToScreen(n.x, n.y, n.z ?? 0, _scene.camera, cr)
      if (Math.hypot(clientX - sx, clientY - sy) < 14) return { memberId: m.id, endpoint: ep }
    }
    return null
  }

  function updateOverlays(wx: number | null, wy: number | null, wz = 0) {
    if (!_rend) return
    // Ghost line: ADD_MEMBER pending start
    const pid = structure.pendingMemberStartNodeId
    const startNode = pid ? structure.nodeById(pid) : null
    if (startNode && wx != null && wy != null) {
      _rend.setGhostLine(startNode, { x: wx, y: wy, z: wz })
    } else {
      _rend.setGhostLine(null, null)
    }
    // Endpoint handles
    const sm = singleSelectedMember.value
    if (sm && activeTool.value === 'SELECT') {
      const n1 = structure.nodeById(sm.startNodeId)
      const n2 = structure.nodeById(sm.endNodeId)
      _rend.setEpHandles([n1, n2].filter(Boolean) as Array<{ x: number; y: number; z?: number }>)
    } else {
      _rend.setEpHandles([])
    }
    // Ep ghost + snap ring during ep drag
    if (_epDrag && wx != null && wy != null) {
      const fixedId = _epDrag.endpoint === 'start'
        ? structure.memberById(_epDrag.memberId)?.endNodeId
        : structure.memberById(_epDrag.memberId)?.startNodeId
      const fixedNode = fixedId ? structure.nodeById(fixedId) : null
      _rend.setEpGhost(fixedNode ?? null, { x: wx, y: wy, z: wz })
      _rend.setSnapRing(_epSnapId ? structure.nodeById(_epSnapId) ?? null : null)
    } else {
      _rend.setEpGhost(null, null)
      _rend.setSnapRing(null)
    }
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button === 1) return
    if (e.button !== 0) return
    const isPan = activeTool.value === 'PAN' || isSpaceHeld.value
    if (isPan) return

    const world = toWorld(e)
    if (!world) return
    const { x: wx, y: wy } = world

    if (activeTool.value === 'ADD_NODE') {
      e.stopPropagation()
      const s = snapPoint(wx, wy)
      structure.addNode({ x: s.x, y: s.y, support: 'free' })
      return
    }
    if (activeTool.value === 'ADD_MEMBER') {
      e.stopPropagation()
      const nid = _scene && _canvas ? hitNode(e.clientX, e.clientY, structure.nodes, _scene, _canvas) : null
      if (nid) {
        if (!structure.pendingMemberStartNodeId) {
          structure.pendingMemberStartNodeId = nid
        } else {
          structure.addMember({
            startNodeId: structure.pendingMemberStartNodeId, endNodeId: nid,
            steelProfileId: null, E: settings.defaultE, A: settings.defaultA,
            I: settings.defaultI, isTruss: structure.structureType === 'truss',
          })
          structure.pendingMemberStartNodeId = null
          updateOverlays(wx, wy, world.z)
        }
      }
      return
    }
    if (activeTool.value === 'ADD_POINT_LOAD' || activeTool.value === 'ADD_MOMENT') {
      e.stopPropagation()
      const nid = _scene && _canvas ? hitNode(e.clientX, e.clientY, structure.nodes, _scene, _canvas) : null
      if (nid) setPendingLoadTarget(nid)
      return
    }
    if (activeTool.value === 'ADD_DIST_LOAD') {
      e.stopPropagation()
      const mid = _scene && _canvas ? hitMember(e.clientX, e.clientY, structure.members, structure.nodeById, _scene, _canvas) : null
      if (mid) setPendingLoadTarget(undefined, mid)
      return
    }
    if (activeTool.value === 'SELECT') {
      const ep = hitEp(e.clientX, e.clientY)
      if (ep) { e.stopPropagation(); _epDrag = ep; return }
      const nid = _scene && _canvas ? hitNode(e.clientX, e.clientY, structure.nodes, _scene, _canvas) : null
      if (nid) {
        e.stopPropagation()
        const n = structure.nodeById(nid)!
        _nodeDrag = { nodeId: nid, startWx: wx, startWy: wy, origX: n.x, origY: n.y }
        if (!structure.selectedNodeIds.includes(nid)) structure.selectNode(nid, e.shiftKey)
        return
      }
      const mid = _scene && _canvas ? hitMember(e.clientX, e.clientY, structure.members, structure.nodeById, _scene, _canvas) : null
      if (mid) { e.stopPropagation(); structure.selectMember(mid, e.shiftKey); return }

      if (cameraMode.value === '3d') {
        // Empty space in 3D: OrbitControls handles rotation; track for click-to-deselect
        _emptyClick3d = { cx: e.clientX, cy: e.clientY }
        return  // no stopPropagation — let OrbitControls rotate
      }
      e.stopPropagation()
      _selStart = { cx: e.clientX, cy: e.clientY }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    // Determine projection plane Z: ep drag → fixed node's Z; ADD_MEMBER → start node's Z
    let planeZ = 0
    if (_epDrag) {
      const fixedId = _epDrag.endpoint === 'start'
        ? structure.memberById(_epDrag.memberId)?.endNodeId
        : structure.memberById(_epDrag.memberId)?.startNodeId
      planeZ = (fixedId ? structure.nodeById(fixedId) : null)?.z ?? 0
    } else {
      const pendingStart = structure.pendingMemberStartNodeId
        ? structure.nodeById(structure.pendingMemberStartNodeId)
        : null
      planeZ = pendingStart?.z ?? 0
    }
    const world = toWorld(e, planeZ)
    _mouseWorld = world

    if (_epDrag && _scene && _canvas) {
      _epSnapId = hitNode(e.clientX, e.clientY, structure.nodes, _scene, _canvas, 15)
    }

    if (_nodeDrag && e.buttons === 1 && world) {
      const base = toWorld(e, 0) ?? world  // node drag stays in XY plane
      let nx = _nodeDrag.origX + (base.x - _nodeDrag.startWx)
      let ny = _nodeDrag.origY + (base.y - _nodeDrag.startWy)
      if (e.shiftKey) { nx = Math.round(nx); ny = Math.round(ny) }
      structure.updateNode(_nodeDrag.nodeId, { x: nx, y: ny })
    }

    if (_selStart && e.buttons === 1 && _canvas) {
      _selDragging = true
      const cr = _canvas.getBoundingClientRect()
      const sx = e.clientX - cr.left, sy = e.clientY - cr.top
      const ox = _selStart.cx - cr.left, oy = _selStart.cy - cr.top
      selectionRect.value = { x: Math.min(sx, ox), y: Math.min(sy, oy), w: Math.abs(sx-ox), h: Math.abs(sy-oy) }
      selectionMode.value = sx >= ox ? 'window' : 'crossing'
    }

    updateOverlays(world?.x ?? null, world?.y ?? null, world?.z ?? 0)
  }

  function handleMouseUp(e: MouseEvent) {
    if (_epDrag) {
      if (_epSnapId) {
        const m = structure.memberById(_epDrag.memberId)
        if (m) structure.updateMember(m.id,
          _epDrag.endpoint === 'start' ? { startNodeId: _epSnapId } : { endNodeId: _epSnapId })
      }
      _epDrag = null; _epSnapId = null
      updateOverlays(_mouseWorld?.x ?? null, _mouseWorld?.y ?? null, _mouseWorld?.z ?? 0)
      return
    }
    if (_nodeDrag) { _nodeDrag = null; return }

    if (_selStart && _selDragging && selectionRect.value && _scene && _canvas) {
      const tl = clientToWorld(_selStart.cx, _selStart.cy, _scene, _canvas)
      const br = clientToWorld(e.clientX, e.clientY, _scene, _canvas)
      if (tl && br) {
        const minX = Math.min(tl.x, br.x), maxX = Math.max(tl.x, br.x)
        const minY = Math.min(tl.y, br.y), maxY = Math.max(tl.y, br.y)
        for (const n of structure.nodes) {
          if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) structure.selectNode(n.id, true)
        }
        const isWindow = selectionMode.value === 'window'
        for (const m of structure.members) {
          const n1 = structure.nodeById(m.startNodeId), n2 = structure.nodeById(m.endNodeId)
          if (!n1 || !n2) continue
          const n1In = n1.x >= minX && n1.x <= maxX && n1.y >= minY && n1.y <= maxY
          const n2In = n2.x >= minX && n2.x <= maxX && n2.y >= minY && n2.y <= maxY
          const hit = isWindow ? (n1In && n2In) : segIntersectsRect(n1.x, n1.y, n2.x, n2.y, minX, minY, maxX, maxY)
          if (hit) structure.selectMember(m.id, true)
        }
      }
    } else if (_selStart && !_selDragging) {
      if (activeTool.value === 'SELECT' && !e.shiftKey) structure.clearSelection()
    }

    _selStart = null; _selDragging = false; selectionRect.value = null

    if (_emptyClick3d) {
      const dx = e.clientX - _emptyClick3d.cx, dy = e.clientY - _emptyClick3d.cy
      if (Math.hypot(dx, dy) < 5 && activeTool.value === 'SELECT' && !e.shiftKey) structure.clearSelection()
      _emptyClick3d = null
    }
  }

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
    if (key === 'F' && _scene) {
      const xs = structure.nodes.map(n => n.x), ys = structure.nodes.map(n => n.y)
      if (xs.length) _scene.fitToView(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys))
    }
    if (key === 'ESCAPE') { structure.pendingMemberStartNodeId = null; updateOverlays(null, null) }
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

  function attach(scene: SceneManager, rend: StructureRenderer, canvas: HTMLElement) {
    _scene = scene; _rend = rend; _canvas = canvas
    canvas.addEventListener('pointerdown', handlePointerDown, { capture: true })
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
  }

  function detach(canvas: HTMLElement) {
    canvas.removeEventListener('pointerdown', handlePointerDown, { capture: true })
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    _scene = null; _rend = null; _canvas = null
  }

  return { selectionRect, selectionMode, isSpaceHeld, attach, detach }
}
