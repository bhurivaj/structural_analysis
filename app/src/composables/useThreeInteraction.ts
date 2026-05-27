import { ref, computed } from 'vue'
import type { SceneManager } from '@/components/canvas/three/SceneManager'
import type { StructureRenderer } from '@/components/canvas/three/StructureRenderer'
import { useStructureStore } from '@/stores/structureStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCanvasTool } from '@/composables/useCanvasTool'
import { useCanvasViewport } from '@/composables/useCanvasViewport'
import { useCanvasMode } from '@/composables/useCanvasMode'
import { useCanvasKeys } from '@/composables/useCanvasKeys'
import { clientToWorld, clientToWorldXZ, projectToScreen, hitNode, hitMember } from '@/composables/threeHitTest'
import { isTopView, toWorldOnPlane, applyRubberBandSelection } from '@/composables/threeViewHelpers'

export type SelectionRect = { x: number; y: number; w: number; h: number }

let _scene: SceneManager | null = null
let _rend: StructureRenderer | null = null
let _canvas: HTMLElement | null = null

export function useThreeInteraction() {
  const structure = useStructureStore()
  const settings = useSettingsStore()
  const { activeTool, setPendingLoadTarget } = useCanvasTool()
  const { snapPoint } = useCanvasViewport()
  const { workplaneZ } = useCanvasMode()
  const { isSpaceHeld, attach: attachKeys, detach: detachKeys } = useCanvasKeys()

  const selectionRect = ref<SelectionRect | null>(null)
  const selectionMode = ref<'window' | 'crossing' | null>(null)

  let _selStart: { cx: number; cy: number; topView: boolean } | null = null
  let _selDragging = false
  let _nodeDrag: {
    nodeId: string; startWx: number; startWy: number
    origX: number; origY: number
    planeVal: number; topView: boolean
  } | null = null
  let _epDrag: { endpoint: 'start' | 'end'; memberId: string } | null = null
  let _epSnapId: string | null = null
  let _mouseWorld: { x: number; y: number; z: number } | null = null

  const singleSelectedMember = computed(() =>
    structure.selectedMemberIds.length === 1
      ? structure.memberById(structure.selectedMemberIds[0]) ?? null
      : null
  )

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
    const pid = structure.pendingMemberStartNodeId
    const startNode = pid ? structure.nodeById(pid) : null
    if (startNode && wx != null && wy != null) {
      _rend.setGhostLine(startNode, { x: wx, y: wy, z: wz })
    } else {
      _rend.setGhostLine(null, null)
    }
    const sm = singleSelectedMember.value
    if (sm && activeTool.value === 'SELECT') {
      const n1 = structure.nodeById(sm.startNodeId)
      const n2 = structure.nodeById(sm.endNodeId)
      _rend.setEpHandles([n1, n2].filter(Boolean) as Array<{ x: number; y: number; z?: number }>)
    } else {
      _rend.setEpHandles([])
    }
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
    if (activeTool.value === 'PAN' || isSpaceHeld.value) return

    const topView = isTopView(_scene)

    if (activeTool.value === 'ADD_NODE') {
      e.stopPropagation()
      const world = _scene && _canvas ? toWorldOnPlane(e.clientX, e.clientY, _scene, _canvas, workplaneZ.value, topView) : null
      if (!world) return
      if (topView) {
        const s = snapPoint(world.x, world.z)
        structure.addNode({ x: s.x, y: workplaneZ.value, z: s.y, support: 'free' })
      } else {
        const s = snapPoint(world.x, world.y)
        structure.addNode({ x: s.x, y: s.y, z: workplaneZ.value, support: 'free' })
      }
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
          updateOverlays(null, null)
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
        const world = _scene && _canvas ? toWorldOnPlane(e.clientX, e.clientY, _scene, _canvas, workplaneZ.value, topView) : null
        _nodeDrag = {
          nodeId: nid,
          startWx: world?.x ?? 0,
          startWy: topView ? (world?.z ?? 0) : (world?.y ?? 0),
          origX: n.x,
          origY: topView ? (n.z ?? 0) : n.y,
          planeVal: topView ? n.y : (n.z ?? workplaneZ.value),
          topView,
        }
        if (!structure.selectedNodeIds.includes(nid)) structure.selectNode(nid, e.shiftKey)
        return
      }

      const mid = _scene && _canvas ? hitMember(e.clientX, e.clientY, structure.members, structure.nodeById, _scene, _canvas) : null
      if (mid) { e.stopPropagation(); structure.selectMember(mid, e.shiftKey); return }

      e.stopPropagation()
      _selStart = { cx: e.clientX, cy: e.clientY, topView }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    const topView = isTopView(_scene)
    let planeVal = workplaneZ.value
    if (_epDrag) {
      const fixedId = _epDrag.endpoint === 'start'
        ? structure.memberById(_epDrag.memberId)?.endNodeId
        : structure.memberById(_epDrag.memberId)?.startNodeId
      const fixedNode = fixedId ? structure.nodeById(fixedId) : null
      planeVal = topView ? (fixedNode?.y ?? workplaneZ.value) : (fixedNode?.z ?? 0)
    } else {
      const ps = structure.pendingMemberStartNodeId ? structure.nodeById(structure.pendingMemberStartNodeId) : null
      planeVal = topView ? (ps?.y ?? workplaneZ.value) : (ps?.z ?? workplaneZ.value)
    }

    const world = _scene && _canvas
      ? (topView ? clientToWorldXZ(e.clientX, e.clientY, _scene, _canvas, planeVal) : clientToWorld(e.clientX, e.clientY, _scene, _canvas, planeVal))
      : null
    _mouseWorld = world

    if (_epDrag && _scene && _canvas) {
      _epSnapId = hitNode(e.clientX, e.clientY, structure.nodes, _scene, _canvas, 15)
    }

    if (_nodeDrag && e.buttons === 1) {
      if (_nodeDrag.topView) {
        const base = _scene && _canvas ? clientToWorldXZ(e.clientX, e.clientY, _scene, _canvas, _nodeDrag.planeVal) : null
        if (base) {
          let nx = _nodeDrag.origX + (base.x - _nodeDrag.startWx)
          let nz = _nodeDrag.origY + (base.z - _nodeDrag.startWy)
          if (e.shiftKey) { nx = Math.round(nx); nz = Math.round(nz) }
          structure.updateNode(_nodeDrag.nodeId, { x: nx, z: nz })
        }
      } else {
        const base = _scene && _canvas ? clientToWorld(e.clientX, e.clientY, _scene, _canvas, _nodeDrag.planeVal) : null
        if (base) {
          let nx = _nodeDrag.origX + (base.x - _nodeDrag.startWx)
          let ny = _nodeDrag.origY + (base.y - _nodeDrag.startWy)
          if (e.shiftKey) { nx = Math.round(nx); ny = Math.round(ny) }
          structure.updateNode(_nodeDrag.nodeId, { x: nx, y: ny })
        }
      }
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
      applyRubberBandSelection(
        _scene, _canvas, _selStart, e.clientX, e.clientY,
        workplaneZ.value, selectionMode.value === 'window',
        structure.nodes, structure.members, structure.nodeById,
        structure.selectNode, structure.selectMember
      )
    } else if (_selStart && !_selDragging) {
      if (activeTool.value === 'SELECT' && !e.shiftKey) structure.clearSelection()
    }

    _selStart = null; _selDragging = false; selectionRect.value = null
  }

  function attach(scene: SceneManager, rend: StructureRenderer, canvas: HTMLElement) {
    _scene = scene; _rend = rend; _canvas = canvas
    canvas.addEventListener('pointerdown', handlePointerDown, { capture: true })
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    attachKeys({
      getScene: () => _scene,
      onEscape: () => { structure.pendingMemberStartNodeId = null; updateOverlays(null, null) },
    })
  }

  function detach(canvas: HTMLElement) {
    canvas.removeEventListener('pointerdown', handlePointerDown, { capture: true })
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
    detachKeys()
    _scene = null; _rend = null; _canvas = null
  }

  return { selectionRect, selectionMode, isSpaceHeld, attach, detach }
}
