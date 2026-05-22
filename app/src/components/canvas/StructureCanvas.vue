<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import * as d3 from 'd3'
import { useCanvasViewport } from '@/composables/useCanvasViewport'
import { useCanvasTool } from '@/composables/useCanvasTool'
import { useStructureStore } from '@/stores/structureStore'
import { useLoadsStore } from '@/stores/loadsStore'
import { useSolverStore } from '@/stores/solverStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useSteelProfileStore } from '@/stores/steelProfileStore'
import { useUndoRedo } from '@/composables/useUndoRedo'

const svgRef = ref<SVGSVGElement | null>(null)
const { viewport, setViewport, screenToWorld } = useCanvasViewport()
const { activeTool, setTool, setPendingLoadTarget, setEditingLoad } = useCanvasTool()
const structure = useStructureStore()
const loads = useLoadsStore()
const solver = useSolverStore()
const settings = useSettingsStore()
const profileStore = useSteelProfileStore()
const { undo, redo } = useUndoRedo()

const isSpaceHeld = ref(false)
const selectionRect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const selectionMode = ref<'window' | 'crossing' | null>(null)
let _selStart: { sx: number; sy: number } | null = null
let _selDragging = false
const mouseCanvasPos = ref<{ x: number; y: number } | null>(null)

const singleSelectedMember = computed(() => {
  if (structure.selectedMemberIds.length !== 1) return null
  return structure.members.find(m => m.id === structure.selectedMemberIds[0]) ?? null
})

// Debounced render to prevent excessive redraws
let renderTimer: ReturnType<typeof setTimeout> | null = null
function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => drawAll(), 16) // ~60fps
}

function screenToWorldVec(sx: number, sy: number): [number, number] {
  const wx = (sx - viewport.value.x) / viewport.value.k
  const wy = -((sy - viewport.value.y) / viewport.value.k)
  return [wx, wy]
}

function drawAll() {
  if (!svgRef.value) return
  const svg = d3.select(svgRef.value)
  const k = viewport.value.k
  
  // Clear and rebuild structure
  svg.selectAll('g').remove()

  const defs = svg.append('defs')
  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('markerWidth', 6)
    .attr('markerHeight', 4)
    .attr('refX', 3)
    .attr('refY', 2)
    .attr('orient', 'auto')
    .append('polygon')
    .attr('points', '0 0, 6 2, 0 4')
    .attr('fill', '#dc2626')

  const g = svg
    .append('g')
    .attr('transform', `translate(${viewport.value.x},${viewport.value.y}) scale(${k})`)

  // Grid layer
  const gridGroup = g.append('g').attr('id', 'grid-layer').style('pointer-events', 'none')
  const gridPx = 80
  const gridSize = gridPx / k
  if (gridSize >= 1) {
    const minX = Math.floor((-viewport.value.x) / k / gridSize) * gridSize
    const maxX = Math.ceil((svgRef.value.clientWidth - viewport.value.x) / k / gridSize) * gridSize
    const minY = Math.floor((-viewport.value.y) / k / gridSize) * gridSize
    const maxY = Math.ceil((svgRef.value.clientHeight - viewport.value.y) / k / gridSize) * gridSize

    for (let x = minX; x <= maxX; x += gridSize) {
      gridGroup.append('line')
        .attr('x1', x).attr('y1', minY)
        .attr('x2', x).attr('y2', maxY)
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1 / k)
    }
    for (let y = minY; y <= maxY; y += gridSize) {
      gridGroup.append('line')
        .attr('x1', minX).attr('y1', y)
        .attr('x2', maxX).attr('y2', y)
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1 / k)
    }
  }

  const memberLayer = g.append('g').attr('id', 'member-layer')
  const memberHitLayer = g.append('g').attr('id', 'member-hit-layer')
  const deformedLayer = g.append('g').attr('id', 'deformed-layer')
  const forceLayer = g.append('g').attr('id', 'force-layer')
  const nodeLayer = g.append('g').attr('id', 'node-layer')

  // Members - UPDATE pattern
  memberLayer.selectAll('line.member-visible').remove()
  memberHitLayer.selectAll('line.member-hit').remove()
  nodeLayer.selectAll('text.member-label').remove()

  for (const member of structure.members) {
    const n1 = structure.nodeById(member.startNodeId)
    const n2 = structure.nodeById(member.endNodeId)
    if (!n1 || !n2) continue

    const isSelected = structure.selectedMemberIds.includes(member.id)
    const isTensionOnly = member.tensionOnly ?? false

    let stroke = '#1e293b'
    let strokeWidth = 2 / k
    if (isSelected) {
      stroke = '#2563eb'
      strokeWidth = 2.5 / k
    }
    if (isTensionOnly) stroke = '#f97316'

    // Visible member line
    memberLayer
      .append('line')
      .attr('class', 'member-visible')
      .attr('x1', n1.x).attr('y1', -n1.y)
      .attr('x2', n2.x).attr('y2', -n2.y)
      .attr('stroke', stroke)
      .attr('stroke-width', strokeWidth)
      .attr('stroke-dasharray', isTensionOnly ? `${6/k},${3/k}` : '')
      .style('pointer-events', 'none')

    // Hit area
    memberHitLayer
      .append('line')
      .attr('class', 'member-hit')
      .attr('x1', n1.x).attr('y1', -n1.y)
      .attr('x2', n2.x).attr('y2', -n2.y)
      .attr('stroke', 'transparent')
      .attr('stroke-width', 14 / k)
      .style('cursor', activeTool.value === 'SELECT' ? 'pointer' : 'default')
      .on('click', () => {
        if (activeTool.value === 'SELECT') {
          structure.selectMember(member.id, true)
        } else if (activeTool.value === 'ADD_DIST_LOAD') {
          setPendingLoadTarget(undefined, member.id)
        }
      })

    // Member label
    const mx = (n1.x + n2.x) / 2
    const my = ((-n1.y) + (-n2.y)) / 2
    const angle = Math.atan2(-n2.y - (-n1.y), n2.x - n1.x) * 180 / Math.PI
    const displayAngle = angle > 90 || angle < -90 ? angle + 180 : angle

    nodeLayer
      .append('text')
      .attr('class', 'member-label')
      .attr('x', mx).attr('y', my - 8 / k)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11 / k)
      .attr('fill', isSelected ? '#2563eb' : '#64748b')
      .attr('transform', `rotate(${displayAngle} ${mx} ${my})`)
      .text(member.label || member.id.slice(0, 6))
      .style('pointer-events', 'none')

    const profile = member.steelProfileId
      ? profileStore.profiles.find(p => p.id === member.steelProfileId)
      : null
    if (profile) {
      nodeLayer
        .append('text')
        .attr('class', 'member-label')
        .attr('x', mx).attr('y', my + 6 / k)
        .attr('text-anchor', 'middle')
        .attr('font-size', 9 / k)
        .attr('fill', '#94a3b8')
        .attr('transform', `rotate(${displayAngle} ${mx} ${my})`)
        .text(profile.designation ?? profile.id.slice(0, 10))
        .style('pointer-events', 'none')
    }
  }

  // Deformed shape
  if (solver.result?.success && solver.showDeformed) {
    const defScale = solver.deformedScale
    for (const member of structure.members) {
      const n1 = structure.nodeById(member.startNodeId)
      const n2 = structure.nodeById(member.endNodeId)
      if (!n1 || !n2) continue

      const res1 = (solver.result.nodeResults as any)[member.startNodeId]
      const res2 = (solver.result.nodeResults as any)[member.endNodeId]
      if (res1 && res2) {
        const d1x = n1.x + (res1.ux ?? 0) * defScale
        const d1y = -n1.y + (res1.uy ?? 0) * defScale
        const d2x = n2.x + (res2.ux ?? 0) * defScale
        const d2y = -n2.y + (res2.uy ?? 0) * defScale

        deformedLayer
          .append('line')
          .attr('x1', d1x).attr('y1', d1y)
          .attr('x2', d2x).attr('y2', d2y)
          .attr('stroke', '#3b82f6')
          .attr('stroke-width', 1.5 / k)
          .attr('stroke-dasharray', `${3/k},${2/k}`)
          .style('pointer-events', 'none')
      }
    }
  }

  // Nodes
  for (const node of structure.nodes) {
    const isSelected = structure.selectedNodeIds.includes(node.id)
    const r = 4 / k

    nodeLayer
      .append('circle')
      .attr('class', 'node')
      .attr('cx', node.x)
      .attr('cy', -node.y)
      .attr('r', r)
      .attr('fill', isSelected ? '#2563eb' : '#1e293b')
      .style('cursor', activeTool.value === 'SELECT' ? 'pointer' : 'crosshair')
      .on('click', () => {
        if (activeTool.value === 'SELECT') {
          structure.selectNode(node.id, true)
        } else if (['ADD_POINT_LOAD', 'ADD_MOMENT'].includes(activeTool.value)) {
          setPendingLoadTarget(node.id)
        } else if (activeTool.value === 'ADD_MEMBER') {
          if (structure.pendingMemberStartNodeId === null) {
            structure.pendingMemberStartNodeId = node.id
          } else {
            structure.addMember({
              startNodeId: structure.pendingMemberStartNodeId,
              endNodeId: node.id,
              steelProfileId: null,
              E: settings.defaultE,
              A: settings.defaultA,
              I: settings.defaultI,
              isTruss: structure.structureType === 'truss'
            })
            structure.pendingMemberStartNodeId = null
          }
        }
      })

    // Support symbols
    if (node.support !== 'free') {
      const sz = 6 / k
      if (node.support === 'pinned' || node.support === 'fixed') {
        nodeLayer.append('line')
          .attr('x1', node.x - sz).attr('y1', -node.y + sz)
          .attr('x2', node.x - sz * 2).attr('y2', -node.y + sz * 2)
          .attr('stroke', '#dc2626').attr('stroke-width', 1.5 / k)
        nodeLayer.append('line')
          .attr('x1', node.x + sz).attr('y1', -node.y + sz)
          .attr('x2', node.x + sz * 2).attr('y2', -node.y + sz * 2)
          .attr('stroke', '#dc2626').attr('stroke-width', 1.5 / k)
      }
      if (node.support === 'roller' || node.support === 'fixed') {
        nodeLayer.append('circle')
          .attr('cx', node.x).attr('cy', -node.y)
          .attr('r', sz)
          .attr('fill', 'none')
          .attr('stroke', '#dc2626')
          .attr('stroke-width', 1.5 / k)
      }
    }

    // Node label
    nodeLayer
      .append('text')
      .attr('x', node.x)
      .attr('y', -node.y + 12 / k)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11 / k)
      .attr('fill', isSelected ? '#2563eb' : '#64748b')
      .text(node.label || node.id.slice(0, 6))
      .style('pointer-events', 'none')
  }

  // Loads
  const arrowLen = 30 / k
  for (const load of loads.loads) {
    if (load.type === 'point_load') {
      const node = structure.nodeById(load.nodeId)
      if (!node) continue
      const mag = Math.sqrt(load.fx ** 2 + load.fy ** 2)
      if (mag === 0) continue

      const nx = load.fx / mag, ny = load.fy / mag
      const x1 = node.x - nx * arrowLen, y1 = -node.y + ny * arrowLen

      const loadGroup = forceLayer
        .append('g')
        .style('cursor', activeTool.value === 'SELECT' ? 'pointer' : 'default')
        .on('click', (event: MouseEvent) => {
          if (activeTool.value !== 'SELECT') return
          event.stopPropagation()
          structure.clearSelection()
          setEditingLoad(load.id)
        })

      loadGroup
        .append('line')
        .attr('x1', x1).attr('y1', y1)
        .attr('x2', node.x).attr('y2', -node.y)
        .attr('stroke', '#dc2626')
        .attr('stroke-width', 2 / k)
        .attr('marker-end', 'url(#arrowhead)')

      loadGroup
        .append('text')
        .attr('x', x1).attr('y', y1 - 4 / k)
        .attr('font-size', 11 / k)
        .attr('fill', '#dc2626')
        .text(`${settings.toForce(mag).toFixed(1)} ${settings.forceUnit}`)
    } else if (load.type === 'distributed_load') {
      const member = structure.memberById(load.memberId)
      if (!member) continue
      const n1 = structure.nodeById(member.startNodeId)
      const n2 = structure.nodeById(member.endNodeId)
      if (!n1 || !n2) continue

      const loadGroup = forceLayer
        .append('g')
        .style('cursor', activeTool.value === 'SELECT' ? 'pointer' : 'default')
        .on('click', (event: MouseEvent) => {
          if (activeTool.value !== 'SELECT') return
          event.stopPropagation()
          structure.clearSelection()
          setEditingLoad(load.id)
        })

      const dx = n2.x - n1.x
      const dy = n2.y - n1.y
      loadGroup
        .append('rect')
        .attr('x', Math.min(n1.x, n2.x) - 50 / k)
        .attr('y', Math.min(-n1.y, -n2.y) - 50 / k)
        .attr('width', Math.abs(dx) + 100 / k)
        .attr('height', Math.abs(dy) + 100 / k)
        .attr('fill', 'none')
        .attr('stroke', 'none')
    } else if (load.type === 'moment') {
      const node = structure.nodeById(load.nodeId)
      if (!node) continue

      const loadGroup = forceLayer
        .append('g')
        .style('cursor', activeTool.value === 'SELECT' ? 'pointer' : 'default')
        .on('click', (event: MouseEvent) => {
          if (activeTool.value !== 'SELECT') return
          event.stopPropagation()
          structure.clearSelection()
          setEditingLoad(load.id)
        })
        .attr('transform', `translate(${node.x},${-node.y})`)

      const r = 12 / k
      loadGroup
        .append('circle')
        .attr('cx', 0).attr('cy', 0)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', '#d97706')
        .attr('stroke-width', 2 / k)
    }
  }

  // Ghost line
  if (structure.pendingMemberStartNodeId !== null && mouseCanvasPos.value) {
    const startNode = structure.nodeById(structure.pendingMemberStartNodeId)
    if (startNode) {
      nodeLayer
        .append('line')
        .attr('class', 'ghost-line')
        .attr('x1', startNode.x).attr('y1', -startNode.y)
        .attr('x2', mouseCanvasPos.value.x).attr('y2', mouseCanvasPos.value.y)
        .attr('stroke', '#3b82f6')
        .attr('stroke-width', 2 / k)
        .attr('stroke-dasharray', `${4/k},${2/k}`)
        .style('pointer-events', 'none')
    }
  }

  // Selection rectangle
  if (selectionRect.value) {
    const r = selectionRect.value
    const isWindow = selectionMode.value === 'window'
    nodeLayer
      .append('rect')
      .attr('x', r.x).attr('y', r.y)
      .attr('width', r.w).attr('height', r.h)
      .attr('fill', 'none')
      .attr('stroke', isWindow ? '#2563eb' : '#22c55e')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', isWindow ? '' : '4,2')
      .style('pointer-events', 'none')
  }
}

function handleMouseMove(event: MouseEvent) {
  if (!svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  const sx = event.clientX - rect.left
  const sy = event.clientY - rect.top
  const [wx, wy] = screenToWorldVec(sx, sy)
  mouseCanvasPos.value = { x: wx, y: wy }

  if (_selDragging && _selStart) {
    selectionRect.value = {
      x: Math.min(_selStart.sx, sx),
      y: Math.min(_selStart.sy, sy),
      w: Math.abs(sx - _selStart.sx),
      h: Math.abs(sy - _selStart.sy)
    }
    selectionMode.value = sx >= _selStart.sx ? 'window' : 'crossing'
  }

  if (activeTool.value === 'PAN' && event.buttons === 1) {
    setViewport({
      ...viewport.value,
      x: viewport.value.x + event.movementX,
      y: viewport.value.y + event.movementY
    })
  }

  scheduleRender()
}

function handleMouseUp() {
  const wasPlainClick = _selStart !== null && !_selDragging

  if (!_selStart || !_selDragging || !selectionRect.value) {
    _selStart = null
    _selDragging = false
    selectionRect.value = null
    if (wasPlainClick && activeTool.value === 'SELECT') {
      structure.clearSelection()
    }
    scheduleRender()
    return
  }

  const r = selectionRect.value
  const topLeft = screenToWorld(r.x, r.y)
  const bottomRight = screenToWorld(r.x + r.w, r.y + r.h)
  const minX = Math.min(topLeft.x, bottomRight.x)
  const maxX = Math.max(topLeft.x, bottomRight.x)
  const minY = Math.min(topLeft.y, bottomRight.y)
  const maxY = Math.max(topLeft.y, bottomRight.y)

  const isWindow = selectionMode.value === 'window'
  for (const node of structure.nodes) {
    const inside = node.x >= minX && node.x <= maxX && node.y >= minY && node.y <= maxY
    if ((isWindow && inside) || (!isWindow)) {
      structure.selectNode(node.id, true)
    }
  }

  for (const member of structure.members) {
    const n1 = structure.nodeById(member.startNodeId)
    const n2 = structure.nodeById(member.endNodeId)
    if (n1 && n2) {
      const inside = n1.x >= minX && n1.x <= maxX && n2.x >= minX && n2.x <= maxX &&
                    n1.y >= minY && n1.y <= maxY && n2.y >= minY && n2.y <= maxY
      if (isWindow && inside) {
        structure.selectMember(member.id, true)
      }
    }
  }

  _selStart = null
  _selDragging = false
  selectionRect.value = null
  scheduleRender()
}

function handleMouseDown(event: MouseEvent) {
  if (event.button !== 0 || !svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  const sx = event.clientX - rect.left
  const sy = event.clientY - rect.top

  if (activeTool.value === 'ADD_NODE') {
    const [wx, wy] = screenToWorldVec(sx, sy)
    structure.addNode({ x: wx, y: wy, support: 'free' })
  } else if (activeTool.value === 'SELECT') {
    _selStart = { sx, sy }
  }
}

function handleMouseDrag() {
  if (_selStart && activeTool.value === 'SELECT') {
    _selDragging = true
  }
}

function handleKeyDown(event: KeyboardEvent) {
  const key = event.key.toUpperCase()
  if (key === 'S') setTool('SELECT')
  if (key === 'P') setTool('PAN')
  if (key === 'N') setTool('ADD_NODE')
  if (key === 'M') setTool('ADD_MEMBER')
  if (key === 'L') setTool('ADD_POINT_LOAD')
  if (key === 'D') setTool('ADD_DIST_LOAD')
  if (key === 'R') setTool('ADD_MOMENT')
  if (key === 'F') fitToView()
  if (key === 'ESCAPE') {
    structure.pendingMemberStartNodeId = null
  }
  if (key === 'Z' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
    event.preventDefault()
    redo()
  } else if (key === 'Z' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    undo()
  } else if (key === 'Y' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    redo()
  } else if (key === 'DELETE' || key === 'BACKSPACE') {
    event.preventDefault()
    structure.selectedNodeIds.forEach(id => structure.deleteNode(id))
    structure.selectedMemberIds.forEach(id => structure.deleteMember(id))
  }

  if (event.code === 'Space' && !event.repeat) {
    isSpaceHeld.value = true
    setTool('PAN')
  }
}

function handleKeyUp(event: KeyboardEvent) {
  if (event.code === 'Space') {
    isSpaceHeld.value = false
    setTool('SELECT')
  }
}

function fitToView() {
  if (structure.nodes.length === 0) return
  const xs = structure.nodes.map(n => n.x)
  const ys = structure.nodes.map(n => n.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const width = maxX - minX || 100
  const height = maxY - minY || 100
  const k = Math.min(800 / (width * 1.2), 600 / (height * 1.2))
  const cx = (minX + maxX) / 2
  const cy = -(minY + maxY) / 2
  setViewport({
    ...viewport.value,
    k,
    x: 400 - cx * k,
    y: 300 + cy * k
  })
}

function captureSnapshot(): string {
  if (!svgRef.value) return ''
  const clone = svgRef.value.cloneNode(true) as SVGSVGElement
  const svgString = new XMLSerializer().serializeToString(clone)
  return `data:image/svg+xml;base64,${btoa(svgString)}`
}

onMounted(() => {
  if (!svgRef.value) return

  const svg = d3.select(svgRef.value)
  svg.on('mousemove', handleMouseMove)
  svg.on('mouseup', handleMouseUp)
  svg.on('mousedown', handleMouseDown)
  svg.on('mouseleave', () => {
    _selStart = null
    _selDragging = false
    selectionRect.value = null
    scheduleRender()
  })

  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)

  svg.on('wheel', (event: WheelEvent) => {
    event.preventDefault()
    const rect = svgRef.value!.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    const [wx, wy] = screenToWorldVec(sx, sy)
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
    const newK = viewport.value.k * zoomFactor
    const newX = sx - wx * newK
    const newY = sy + wy * newK
    setViewport({
      ...viewport.value,
      k: newK,
      x: newX,
      y: newY
    })
  })

  watch(
    [
      () => structure.nodes,
      () => structure.members,
      () => structure.selectedNodeIds,
      () => structure.selectedMemberIds,
      () => loads.loads,
      () => solver.result,
      () => viewport.value,
      () => activeTool.value
    ],
    () => scheduleRender(),
    { deep: true }
  )

  drawAll()
})

onUnmounted(() => {
  if (renderTimer) clearTimeout(renderTimer)
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
})

defineExpose({ captureSnapshot, fitToView })
</script>

<template>
  <svg ref="svgRef" class="w-full h-full bg-white" />
</template>
