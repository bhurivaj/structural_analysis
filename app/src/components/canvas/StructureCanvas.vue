<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
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
const { viewport, setViewport, screenToWorld, toggleSnap, snapPoint } = useCanvasViewport()
const { activeTool, setTool, setPendingLoadTarget, setEditingLoad } = useCanvasTool()
const structure = useStructureStore()
const loads = useLoadsStore()
const solver = useSolverStore()
const settings = useSettingsStore()
const profileStore = useSteelProfileStore()
const { undo, redo } = useUndoRedo()

const isSpaceHeld = ref(false)
const isShiftHeld = ref(false)
const selectionRect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const selectionMode = ref<'window' | 'crossing' | null>(null)
let _selStart: { sx: number; sy: number } | null = null
let _selDragging = false
const mouseCanvasPos = ref<{ x: number; y: number } | null>(null)

// Endpoint reconnect drag state
let _epDragging: { endpoint: 'start' | 'end'; memberId: string } | null = null
let _epGhostPos: { x: number; y: number } | null = null
let _epSnapNodeId: string | null = null

// Node drag state
let _nodeDragging: { nodeId: string; startWx: number; startWy: number; origX: number; origY: number } | null = null

const singleSelectedMember = computed(() => {
  if (structure.selectedMemberIds.length !== 1) return null
  return structure.members.find(m => m.id === structure.selectedMemberIds[0]) ?? null
})

const canvasCursor = computed(() => {
  if (activeTool.value === 'PAN' || isSpaceHeld.value) return 'grab'
  if (['ADD_NODE', 'ADD_MEMBER', 'ADD_POINT_LOAD', 'ADD_DIST_LOAD', 'ADD_MOMENT'].includes(activeTool.value)) return 'crosshair'
  return 'default'
})

const selectionOverlayStyle = computed(() => {
  if (!selectionRect.value) return {}
  const r = selectionRect.value
  const isWindow = selectionMode.value === 'window'
  return {
    position: 'absolute' as const,
    left: `${r.x}px`,
    top: `${r.y}px`,
    width: `${r.w}px`,
    height: `${r.h}px`,
    border: isWindow ? '1.5px solid #2563eb' : '1.5px dashed #22c55e',
    background: isWindow ? 'rgba(37,99,235,0.05)' : 'rgba(34,197,94,0.05)',
    pointerEvents: 'none' as const,
  }
})

let renderTimer: ReturnType<typeof setTimeout> | null = null
function scheduleRender() {
  if (renderTimer) clearTimeout(renderTimer)
  renderTimer = setTimeout(() => drawAll(), 16)
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

  svg.selectAll('g').remove()

  const defs = svg.append('defs')
  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('markerWidth', 6).attr('markerHeight', 4)
    .attr('refX', 3).attr('refY', 2)
    .attr('orient', 'auto')
    .append('polygon')
    .attr('points', '0 0, 6 2, 0 4')
    .attr('fill', '#dc2626')
  defs.append('marker')
    .attr('id', 'arrowhead-dl')
    .attr('markerWidth', 6).attr('markerHeight', 4)
    .attr('refX', 3).attr('refY', 2)
    .attr('orient', 'auto')
    .append('polygon')
    .attr('points', '0 0, 6 2, 0 4')
    .attr('fill', '#7c3aed')

  const g = svg.append('g')
    .attr('transform', `translate(${viewport.value.x},${viewport.value.y}) scale(${k})`)

  // Grid — adaptive size keeps ~80px screen spacing at any zoom
  const gridGroup = g.append('g').attr('id', 'grid-layer').style('pointer-events', 'none')
  const rawWorld = 80 / k
  const gridSize = Math.pow(2, Math.ceil(Math.log2(rawWorld)))
  const minX = Math.floor((-viewport.value.x) / k / gridSize) * gridSize
  const maxX = Math.ceil((svgRef.value.clientWidth - viewport.value.x) / k / gridSize) * gridSize
  const minY = Math.floor((-viewport.value.y) / k / gridSize) * gridSize
  const maxY = Math.ceil((svgRef.value.clientHeight - viewport.value.y) / k / gridSize) * gridSize
  for (let x = minX; x <= maxX; x += gridSize) {
    gridGroup.append('line')
      .attr('x1', x).attr('y1', minY).attr('x2', x).attr('y2', maxY)
      .attr('stroke', '#e2e8f0').attr('stroke-width', 1 / k)
  }
  for (let y = minY; y <= maxY; y += gridSize) {
    gridGroup.append('line')
      .attr('x1', minX).attr('y1', y).attr('x2', maxX).attr('y2', y)
      .attr('stroke', '#e2e8f0').attr('stroke-width', 1 / k)
  }
  // Origin crosshair at (0,0)
  const cross = 12 / k
  gridGroup.append('line')
    .attr('x1', -cross).attr('y1', 0).attr('x2', cross).attr('y2', 0)
    .attr('stroke', '#94a3b8').attr('stroke-width', 1.5 / k)
  gridGroup.append('line')
    .attr('x1', 0).attr('y1', -cross).attr('x2', 0).attr('y2', cross)
    .attr('stroke', '#94a3b8').attr('stroke-width', 1.5 / k)

  const memberLayer = g.append('g').attr('id', 'member-layer')
  const memberHitLayer = g.append('g').attr('id', 'member-hit-layer')
  const deformedLayer = g.append('g').attr('id', 'deformed-layer')
  const forceLayer = g.append('g').attr('id', 'force-layer')
  const nodeLayer = g.append('g').attr('id', 'node-layer')
  const handleLayer = g.append('g').attr('id', 'handle-layer')

  // Members
  for (const member of structure.members) {
    const n1 = structure.nodeById(member.startNodeId)
    const n2 = structure.nodeById(member.endNodeId)
    if (!n1 || !n2) continue

    const isSelected = structure.selectedMemberIds.includes(member.id)
    const isTensionOnly = member.tensionOnly ?? false

    let stroke = '#475569'
    let strokeWidth = 2 / k
    if (isSelected) { stroke = '#2563eb'; strokeWidth = 2.5 / k }
    if (isTensionOnly) stroke = '#f97316'

    // Visible line — class 'member' so tests can find it
    memberLayer.append('line')
      .attr('class', 'member member-visible')
      .attr('x1', n1.x).attr('y1', -n1.y)
      .attr('x2', n2.x).attr('y2', -n2.y)
      .attr('stroke', stroke)
      .attr('stroke-width', strokeWidth)
      .attr('stroke-dasharray', isTensionOnly ? `${6/k},${3/k}` : '')
      .style('pointer-events', 'none')

    // Wide hit area
    memberHitLayer.append('line')
      .attr('class', 'member-hit')
      .attr('x1', n1.x).attr('y1', -n1.y)
      .attr('x2', n2.x).attr('y2', -n2.y)
      .attr('stroke', 'transparent')
      .attr('stroke-width', 14 / k)
      .style('cursor', activeTool.value === 'SELECT' ? 'pointer' : 'default')
      .on('click', (event: MouseEvent) => {
        if (activeTool.value === 'SELECT') {
          structure.selectMember(member.id, event.shiftKey)
        } else if (activeTool.value === 'ADD_DIST_LOAD') {
          setPendingLoadTarget(undefined, member.id)
        }
      })

    // Member label — uses translate+rotate so transform contains both keywords
    const mx = (n1.x + n2.x) / 2
    const my = ((-n1.y) + (-n2.y)) / 2
    const angle = Math.atan2(-n2.y - (-n1.y), n2.x - n1.x) * 180 / Math.PI
    const displayAngle = angle > 90 || angle < -90 ? angle + 180 : angle

    nodeLayer.append('text')
      .attr('class', 'member-label')
      .attr('x', 0).attr('y', -8 / k)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11 / k)
      .attr('fill', isSelected ? '#2563eb' : '#64748b')
      .attr('transform', `translate(${mx},${my}) rotate(${displayAngle})`)
      .text(member.label || member.id.slice(0, 6))
      .style('pointer-events', 'none')

    const profile = member.steelProfileId
      ? profileStore.profiles.find(p => p.id === member.steelProfileId)
      : null
    if (profile) {
      nodeLayer.append('text')
        .attr('class', 'member-label')
        .attr('x', 0).attr('y', 16 / k)
        .attr('text-anchor', 'middle')
        .attr('font-size', 9 / k)
        .attr('fill', '#94a3b8')
        .attr('transform', `translate(${mx},${my}) rotate(${displayAngle})`)
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
        deformedLayer.append('line')
          .attr('x1', n1.x + (res1.ux ?? 0) * defScale).attr('y1', -n1.y + (res1.uy ?? 0) * defScale)
          .attr('x2', n2.x + (res2.ux ?? 0) * defScale).attr('y2', -n2.y + (res2.uy ?? 0) * defScale)
          .attr('stroke', '#3b82f6').attr('stroke-width', 1.5 / k)
          .attr('stroke-dasharray', `${3/k},${2/k}`)
          .style('pointer-events', 'none')
      }
    }
  }

  // Nodes
  for (const node of structure.nodes) {
    const isSelected = structure.selectedNodeIds.includes(node.id)
    const r = 4 / k

    nodeLayer.append('circle')
      .attr('class', 'node')
      .attr('cx', node.x).attr('cy', -node.y)
      .attr('r', r)
      .attr('fill', isSelected ? '#2563eb' : '#1e293b')
      .style('cursor', activeTool.value === 'SELECT' ? 'pointer' : 'crosshair')
      .on('mousedown', (event: MouseEvent) => {
        if (activeTool.value !== 'SELECT') return
        if (!svgRef.value) return
        event.stopPropagation()
        const rect = svgRef.value.getBoundingClientRect()
        const sx = event.clientX - rect.left
        const sy = event.clientY - rect.top
        const [wx, wy] = screenToWorldVec(sx, sy)
        _nodeDragging = { nodeId: node.id, startWx: wx, startWy: wy, origX: node.x, origY: node.y }
      })
      .on('click', (event: MouseEvent) => {
        if (_nodeDragging) return // suppress click after drag
        if (activeTool.value === 'SELECT') {
          structure.selectNode(node.id, event.shiftKey)
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
      const sz = 8 / k
      const cx = node.x, cy = -node.y
      const col = '#dc2626'
      const sw = 1.5 / k

      if (node.support === 'pinned') {
        // Triangle pointing down + horizontal base + hatch marks
        const triPts = `${cx},${cy} ${cx - sz * 1.4},${cy + sz * 2} ${cx + sz * 1.4},${cy + sz * 2}`
        nodeLayer.append('polygon')
          .attr('points', triPts)
          .attr('fill', 'none').attr('stroke', col).attr('stroke-width', sw)
          .style('pointer-events', 'none')
        nodeLayer.append('line')
          .attr('x1', cx - sz * 1.7).attr('y1', cy + sz * 2)
          .attr('x2', cx + sz * 1.7).attr('y2', cy + sz * 2)
          .attr('stroke', col).attr('stroke-width', sw)
          .style('pointer-events', 'none')
        for (let i = 0; i < 4; i++) {
          const hx = cx - sz * 1.3 + i * sz * 0.85
          nodeLayer.append('line')
            .attr('x1', hx).attr('y1', cy + sz * 2)
            .attr('x2', hx - sz * 0.5).attr('y2', cy + sz * 2.7)
            .attr('stroke', col).attr('stroke-width', sw)
            .style('pointer-events', 'none')
        }
      } else if (node.support === 'roller') {
        if (node.rollerAxis === 'x') {
          // Horizontal roller (constrained in X): triangle pointing LEFT
          // apex at node, base is a vertical line to the left
          const triPts = `${cx},${cy} ${cx - sz * 2},${cy - sz * 1.4} ${cx - sz * 2},${cy + sz * 1.4}`
          nodeLayer.append('polygon')
            .attr('points', triPts)
            .attr('fill', 'none').attr('stroke', col).attr('stroke-width', sw)
            .style('pointer-events', 'none')
          // Vertical base line
          nodeLayer.append('line')
            .attr('x1', cx - sz * 2).attr('y1', cy - sz * 1.7)
            .attr('x2', cx - sz * 2).attr('y2', cy + sz * 1.7)
            .attr('stroke', col).attr('stroke-width', sw)
            .style('pointer-events', 'none')
          // Two wheels (circles) side-by-side vertically
          nodeLayer.append('circle')
            .attr('cx', cx - sz * 2.8).attr('cy', cy - sz * 0.6).attr('r', sz * 0.4)
            .attr('fill', 'none').attr('stroke', col).attr('stroke-width', sw)
            .style('pointer-events', 'none')
          nodeLayer.append('circle')
            .attr('cx', cx - sz * 2.8).attr('cy', cy + sz * 0.6).attr('r', sz * 0.4)
            .attr('fill', 'none').attr('stroke', col).attr('stroke-width', sw)
            .style('pointer-events', 'none')
          // Vertical ground line
          nodeLayer.append('line')
            .attr('x1', cx - sz * 3.4).attr('y1', cy - sz * 1.7)
            .attr('x2', cx - sz * 3.4).attr('y2', cy + sz * 1.7)
            .attr('stroke', col).attr('stroke-width', sw)
            .style('pointer-events', 'none')
        } else {
          // Vertical roller (constrained in Y, default): triangle pointing DOWN
          const triPts = `${cx},${cy} ${cx - sz * 1.4},${cy + sz * 2} ${cx + sz * 1.4},${cy + sz * 2}`
          nodeLayer.append('polygon')
            .attr('points', triPts)
            .attr('fill', 'none').attr('stroke', col).attr('stroke-width', sw)
            .style('pointer-events', 'none')
          // Horizontal base line
          nodeLayer.append('line')
            .attr('x1', cx - sz * 1.7).attr('y1', cy + sz * 2)
            .attr('x2', cx + sz * 1.7).attr('y2', cy + sz * 2)
            .attr('stroke', col).attr('stroke-width', sw)
            .style('pointer-events', 'none')
          // Two wheels (circles) side-by-side horizontally
          nodeLayer.append('circle')
            .attr('cx', cx - sz * 0.6).attr('cy', cy + sz * 2.8).attr('r', sz * 0.4)
            .attr('fill', 'none').attr('stroke', col).attr('stroke-width', sw)
            .style('pointer-events', 'none')
          nodeLayer.append('circle')
            .attr('cx', cx + sz * 0.6).attr('cy', cy + sz * 2.8).attr('r', sz * 0.4)
            .attr('fill', 'none').attr('stroke', col).attr('stroke-width', sw)
            .style('pointer-events', 'none')
          // Horizontal ground line
          nodeLayer.append('line')
            .attr('x1', cx - sz * 1.7).attr('y1', cy + sz * 3.4)
            .attr('x2', cx + sz * 1.7).attr('y2', cy + sz * 3.4)
            .attr('stroke', col).attr('stroke-width', sw)
            .style('pointer-events', 'none')
        }
      }

      if (node.support === 'fixed') {
        // Thick horizontal bar through node
        nodeLayer.append('rect')
          .attr('x', cx - sz * 2).attr('y', cy - sz * -0.5)
          .attr('width', sz * 4).attr('height', sz * 1)
          .attr('fill', col).attr('rx', 1 / k)
          .style('pointer-events', 'none')
        // Hatch lines below bar
        for (let i = 0; i < 5; i++) {
          const hx = cx - sz * 1.7 + i * sz * 0.85
          nodeLayer.append('line')
            .attr('x1', hx).attr('y1', cy + sz * 1.5)
            .attr('x2', hx - sz * 0.5).attr('y2', cy + sz * 2.2)
            .attr('stroke', col).attr('stroke-width', sw)
            .style('pointer-events', 'none')
        }
      }
    }

    nodeLayer.append('text')
      .attr('x', node.x).attr('y', -node.y + 12 / k)
      .attr('text-anchor', 'middle').attr('font-size', 11 / k)
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

      const loadGroup = forceLayer.append('g')
        .style('cursor', activeTool.value === 'SELECT' ? 'pointer' : 'default')
        .on('click', (event: MouseEvent) => {
          if (activeTool.value !== 'SELECT') return
          event.stopPropagation()
          structure.clearSelection()
          setEditingLoad(load.id)
        })

      loadGroup.append('line')
        .attr('x1', x1).attr('y1', y1).attr('x2', node.x).attr('y2', -node.y)
        .attr('stroke', '#dc2626').attr('stroke-width', 2 / k)
        .attr('marker-end', 'url(#arrowhead)')

      loadGroup.append('text')
        .attr('x', x1).attr('y', y1 - 4 / k)
        .attr('font-size', 11 / k).attr('fill', '#dc2626')
        .text(`${settings.toForce(mag).toFixed(1)} ${settings.forceUnit}`)

    } else if (load.type === 'distributed_load') {
      const member = structure.memberById(load.memberId)
      if (!member) continue
      const n1 = structure.nodeById(member.startNodeId)
      const n2 = structure.nodeById(member.endNodeId)
      if (!n1 || !n2) continue

      const loadGroup = forceLayer.append('g')
        .style('cursor', activeTool.value === 'SELECT' ? 'pointer' : 'default')
        .on('click', (event: MouseEvent) => {
          if (activeTool.value !== 'SELECT') return
          event.stopPropagation()
          structure.clearSelection()
          setEditingLoad(load.id)
        })

      const dx = n2.x - n1.x
      const dy = n2.y - n1.y
      const L = Math.sqrt(dx * dx + dy * dy)
      if (L < 1e-9) continue

      const ux = dx / L, uy = dy / L
      // Local Y+ perpendicular: rotate member direction 90° CCW
      const perpX = -uy, perpY = ux
      const dlCol = '#7c3aed'
      const sw = 1.5 / k
      const arrowScale = 25 / k  // visual scale: 1 kN/m = 25/k canvas units
      const numArrows = 7

      // Build tip and base point arrays for polygon fill and baseline
      const tipPtsSvg: string[] = []
      const basePtsSvg: string[] = []

      for (let i = 0; i <= numArrows; i++) {
        const t = i / numArrows
        const px = n1.x + t * dx, py = n1.y + t * dy  // world coords
        const w = load.w1 + t * (load.w2 - load.w1)

        // Tip offset direction: w<0 → tip on +perp side (above for horizontal beam)
        let nX: number, nY: number
        if (load.direction === 'global_y') {
          nX = 0; nY = 1  // world Y+ = upward
        } else {
          nX = perpX; nY = perpY
        }
        const len = Math.abs(w) * arrowScale
        const sign = w < 0 ? 1 : -1  // w<0 → tip on positive perp side
        const tipWx = px + nX * len * sign
        const tipWy = py + nY * len * sign

        tipPtsSvg.push(`${tipWx},${-tipWy}`)
        basePtsSvg.push(`${px},${-py}`)

        // Individual arrow (skip last to avoid double-drawing at same pos)
        if (i < numArrows && Math.abs(w) > 1e-9) {
          loadGroup.append('line')
            .attr('x1', tipWx).attr('y1', -tipWy)
            .attr('x2', px).attr('y2', -py)
            .attr('stroke', dlCol).attr('stroke-width', sw)
            .attr('marker-end', 'url(#arrowhead-dl)')
            .style('pointer-events', 'none')
        }
      }

      // Filled trapezoidal region
      const allPts = [...tipPtsSvg, ...[...basePtsSvg].reverse()].join(' ')
      loadGroup.insert('polygon', ':first-child')
        .attr('points', allPts)
        .attr('fill', '#7c3aed22').attr('stroke', 'none')
        .style('pointer-events', 'none')
      // Baseline along tips
      loadGroup.append('polyline')
        .attr('points', tipPtsSvg.join(' '))
        .attr('fill', 'none').attr('stroke', dlCol).attr('stroke-width', sw)
        .style('pointer-events', 'none')

      // Labels w1 and w2 at ends
      const tip0 = tipPtsSvg[0].split(',').map(Number)
      const tipN = tipPtsSvg[numArrows].split(',').map(Number)
      loadGroup.append('text')
        .attr('x', tip0[0]).attr('y', tip0[1] - 4 / k)
        .attr('font-size', 10 / k).attr('fill', dlCol).attr('text-anchor', 'middle')
        .text(`${settings.toForce(load.w1).toFixed(1)}`)
        .style('pointer-events', 'none')
      loadGroup.append('text')
        .attr('x', tipN[0]).attr('y', tipN[1] - 4 / k)
        .attr('font-size', 10 / k).attr('fill', dlCol).attr('text-anchor', 'middle')
        .text(`${settings.toForce(load.w2).toFixed(1)} ${settings.distForceLabel}`)
        .style('pointer-events', 'none')

      // Invisible wide hit rect for click detection
      loadGroup.append('rect')
        .attr('x', Math.min(n1.x, n2.x) - 50 / k)
        .attr('y', Math.min(-n1.y, -n2.y) - 50 / k)
        .attr('width', Math.abs(dx) + 100 / k)
        .attr('height', Math.abs(dy) + 100 / k)
        .attr('fill', 'none').attr('stroke', 'none')

    } else if (load.type === 'moment') {
      const node = structure.nodeById(load.nodeId)
      if (!node) continue

      const loadGroup = forceLayer.append('g')
        .style('cursor', activeTool.value === 'SELECT' ? 'pointer' : 'default')
        .on('click', (event: MouseEvent) => {
          if (activeTool.value !== 'SELECT') return
          event.stopPropagation()
          structure.clearSelection()
          setEditingLoad(load.id)
        })
        .attr('transform', `translate(${node.x},${-node.y})`)

      const r = 12 / k
      loadGroup.append('circle')
        .attr('cx', 0).attr('cy', 0).attr('r', r)
        .attr('fill', 'none').attr('stroke', '#d97706').attr('stroke-width', 2 / k)
    }
  }

  // Ghost line for ADD_MEMBER
  if (structure.pendingMemberStartNodeId !== null && mouseCanvasPos.value) {
    const startNode = structure.nodeById(structure.pendingMemberStartNodeId)
    if (startNode) {
      nodeLayer.append('line')
        .attr('class', 'ghost-line')
        .attr('x1', startNode.x).attr('y1', -startNode.y)
        .attr('x2', mouseCanvasPos.value.x).attr('y2', -mouseCanvasPos.value.y)
        .attr('stroke', '#3b82f6').attr('stroke-width', 2 / k)
        .attr('stroke-dasharray', `${4/k},${2/k}`)
        .style('pointer-events', 'none')
    }
  }

  // Endpoint reconnect handles (shown when exactly 1 member is selected)
  const selMember = singleSelectedMember.value
  if (selMember && activeTool.value === 'SELECT') {
    const n1 = structure.nodeById(selMember.startNodeId)
    const n2 = structure.nodeById(selMember.endNodeId)
    if (n1 && n2) {
      for (const { node: epNode, endpoint } of [
        { node: n1, endpoint: 'start' as const },
        { node: n2, endpoint: 'end' as const },
      ]) {
        handleLayer.append('circle')
          .attr('class', 'ep-handle')
          .attr('cx', epNode.x).attr('cy', -epNode.y)
          .attr('r', 6 / k)
          .attr('fill', 'white').attr('stroke', '#2563eb').attr('stroke-width', 2 / k)
          .style('cursor', 'grab')
          .on('mousedown', (event: MouseEvent) => {
            event.stopPropagation()
            _epDragging = { endpoint, memberId: selMember.id }
            _epGhostPos = { x: epNode.x, y: -epNode.y }
          })
      }
    }

    // Ghost line during ep drag
    if (_epDragging && _epGhostPos && n1 && n2) {
      const fixedNode = _epDragging.endpoint === 'start' ? n2 : n1
      handleLayer.append('line')
        .attr('class', 'ep-ghost')
        .attr('x1', fixedNode.x).attr('y1', -fixedNode.y)
        .attr('x2', _epGhostPos.x).attr('y2', -_epGhostPos.y)
        .attr('stroke', '#3b82f6').attr('stroke-width', 1.5 / k)
        .attr('stroke-dasharray', `${4/k},${2/k}`)
        .style('pointer-events', 'none')
    }
  }

  // Snap highlight during ep drag
  if (_epSnapNodeId) {
    const snapNode = structure.nodeById(_epSnapNodeId)
    if (snapNode) {
      handleLayer.append('circle')
        .attr('class', 'ep-snap')
        .attr('cx', snapNode.x).attr('cy', -snapNode.y)
        .attr('r', 8 / k)
        .attr('fill', 'none').attr('stroke', '#2563eb').attr('stroke-width', 2 / k)
        .attr('stroke-dasharray', `${3/k},${2/k}`)
        .style('pointer-events', 'none')
    }
  }
}

function handleMouseMove(event: MouseEvent) {
  if (!svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  const sx = event.clientX - rect.left
  const sy = event.clientY - rect.top
  const [wx, wy] = screenToWorldVec(sx, sy)
  mouseCanvasPos.value = { x: wx, y: wy }

  // Rubber-band selection
  if (_selStart && event.buttons === 1 && activeTool.value === 'SELECT') {
    _selDragging = true
    selectionRect.value = {
      x: Math.min(_selStart.sx, sx),
      y: Math.min(_selStart.sy, sy),
      w: Math.abs(sx - _selStart.sx),
      h: Math.abs(sy - _selStart.sy)
    }
    selectionMode.value = sx >= _selStart.sx ? 'window' : 'crossing'
  }

  // Endpoint handle drag
  if (_epDragging) {
    _epGhostPos = { x: wx, y: wy }
    _epSnapNodeId = null
    const snapRadius = 20 / viewport.value.k
    for (const n of structure.nodes) {
      const dist = Math.sqrt((n.x - wx) ** 2 + (n.y - wy) ** 2)
      if (dist < snapRadius) {
        _epSnapNodeId = n.id
        break
      }
    }
  }

  // Node drag
  if (_nodeDragging && event.buttons === 1) {
    const dx = wx - _nodeDragging.startWx
    const dy = wy - _nodeDragging.startWy
    let newX = _nodeDragging.origX + dx
    let newY = _nodeDragging.origY + dy
    if (event.shiftKey) {
      newX = Math.round(newX)
      newY = Math.round(newY)
    }
    structure.updateNode(_nodeDragging.nodeId, { x: newX, y: newY })
  }

  // Pan (with PAN tool, Space+drag, or middle mouse button)
  const isMiddlePressed = (event.buttons & 4) !== 0
  if ((activeTool.value === 'PAN' || isSpaceHeld.value || isMiddlePressed) && event.buttons !== 0) {
    setViewport({
      ...viewport.value,
      x: viewport.value.x + event.movementX,
      y: viewport.value.y + event.movementY
    })
  }

  scheduleRender()
}

function segCross(ax: number, ay: number, bx: number, by: number,
                  cx: number, cy: number, dx: number, dy: number): boolean {
  const cross = (ux: number, uy: number, vx: number, vy: number) => ux * vy - uy * vx
  const abx = bx - ax, aby = by - ay
  const d1 = cross(abx, aby, cx - ax, cy - ay)
  const d2 = cross(abx, aby, dx - ax, dy - ay)
  const cdx = dx - cx, cdy = dy - cy
  const d3 = cross(cdx, cdy, ax - cx, ay - cy)
  const d4 = cross(cdx, cdy, bx - cx, by - cy)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
  return false
}

function segmentIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  minX: number, minY: number, maxX: number, maxY: number
): boolean {
  if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) return true
  if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) return true
  return segCross(x1, y1, x2, y2, minX, minY, maxX, minY) ||
         segCross(x1, y1, x2, y2, maxX, minY, maxX, maxY) ||
         segCross(x1, y1, x2, y2, maxX, maxY, minX, maxY) ||
         segCross(x1, y1, x2, y2, minX, maxY, minX, minY)
}

function handleMouseUp(event: MouseEvent) {
  // Endpoint reconnect
  if (_epDragging) {
    if (_epSnapNodeId) {
      const member = structure.memberById(_epDragging.memberId)
      if (member) {
        if (_epDragging.endpoint === 'start') {
          structure.updateMember(member.id, { startNodeId: _epSnapNodeId })
        } else {
          structure.updateMember(member.id, { endNodeId: _epSnapNodeId })
        }
      }
    }
    _epDragging = null
    _epGhostPos = null
    _epSnapNodeId = null
    scheduleRender()
    return
  }

  // Node drag commit
  if (_nodeDragging) {
    _nodeDragging = null
    scheduleRender()
    return
  }

  const wasPlainClick = _selStart !== null && !_selDragging

  if (!_selStart || !_selDragging || !selectionRect.value) {
    _selStart = null
    _selDragging = false
    selectionRect.value = null
    if (wasPlainClick && activeTool.value === 'SELECT' && !event.shiftKey) {
      structure.clearSelection()
    }
    scheduleRender()
    return
  }

  // Rubber-band selection complete
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
    if (inside) structure.selectNode(node.id, true)
  }
  for (const member of structure.members) {
    const n1 = structure.nodeById(member.startNodeId)
    const n2 = structure.nodeById(member.endNodeId)
    if (n1 && n2) {
      const n1In = n1.x >= minX && n1.x <= maxX && n1.y >= minY && n1.y <= maxY
      const n2In = n2.x >= minX && n2.x <= maxX && n2.y >= minY && n2.y <= maxY
      const crosses = isWindow ? (n1In && n2In)
        : segmentIntersectsRect(n1.x, n1.y, n2.x, n2.y, minX, minY, maxX, maxY)
      if (crosses) structure.selectMember(member.id, true)
    }
  }

  _selStart = null
  _selDragging = false
  selectionRect.value = null
  scheduleRender()
}

function handleMouseDown(event: MouseEvent) {
  if (!svgRef.value) return
  const rect = svgRef.value.getBoundingClientRect()
  const sx = event.clientX - rect.left
  const sy = event.clientY - rect.top

  // Middle mouse button activates pan
  if (event.button === 1) {
    _selStart = { sx, sy }
    _selDragging = false
    return
  }

  if (event.button !== 0) return

  if (activeTool.value === 'ADD_NODE') {
    const [wx, wy] = screenToWorldVec(sx, sy)
    const snapped = snapPoint(wx, wy)
    structure.addNode({ x: snapped.x, y: snapped.y, support: 'free' })
  } else if (activeTool.value === 'SELECT') {
    _selStart = { sx, sy }
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return

  if (event.key === 'Shift') { isShiftHeld.value = true; return }

  const key = event.key.toUpperCase()
  if (key === 'S') setTool('SELECT')
  if (key === 'P') setTool('PAN')
  if (key === 'N') setTool('ADD_NODE')
  if (key === 'M') setTool('ADD_MEMBER')
  if (key === 'L') setTool('ADD_POINT_LOAD')
  if (key === 'D') setTool('ADD_DIST_LOAD')
  if (key === 'R') setTool('ADD_MOMENT')
  if (key === 'F') fitToView()
  if (key === 'G') { toggleSnap(); scheduleRender(); return }
  if (key === 'ESCAPE') {
    structure.pendingMemberStartNodeId = null
    scheduleRender()
  }

  if (key === 'Z' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
    event.preventDefault(); redo()
  } else if (key === 'Z' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault(); undo()
  } else if (key === 'Y' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault(); redo()
  } else if (key === 'DELETE' || key === 'BACKSPACE') {
    event.preventDefault()
    const nodeIds = [...structure.selectedNodeIds]
    const memberIds = [...structure.selectedMemberIds]
    nodeIds.forEach(id => structure.deleteNode(id))
    memberIds.forEach(id => structure.deleteMember(id))
  }

  if (event.code === 'Space' && !event.repeat) {
    isSpaceHeld.value = true
    setTool('PAN')
  }
}

function handleKeyUp(event: KeyboardEvent) {
  if (event.key === 'Shift') isShiftHeld.value = false
  if (event.code === 'Space') {
    isSpaceHeld.value = false
    setTool('SELECT')
  }
}

function fitToView() {
  if (!svgRef.value || structure.nodes.length === 0) return
  const W = svgRef.value.clientWidth
  const H = svgRef.value.clientHeight
  const xs = structure.nodes.map(n => n.x)
  const ys = structure.nodes.map(n => n.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const width = maxX - minX || 1
  const height = maxY - minY || 1
  const k = Math.min(W / (width * 1.3), H / (height * 1.3))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  setViewport({ ...viewport.value, k, x: W / 2 - cx * k, y: H / 2 + cy * k })
}

function captureSnapshot(): string {
  if (!svgRef.value) return ''
  const W = svgRef.value.clientWidth
  const H = svgRef.value.clientHeight
  const clone = svgRef.value.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(W))
  clone.setAttribute('height', String(H))
  clone.setAttribute('viewBox', `0 0 ${W} ${H}`)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const svgStr = new XMLSerializer().serializeToString(clone)
  const bytes = new TextEncoder().encode(svgStr)
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('')
  return `data:image/svg+xml;base64,${btoa(binary)}`
}

onMounted(() => {
  if (!svgRef.value) return

  // Center world origin (0,0) at screen center
  const W = svgRef.value.clientWidth
  const H = svgRef.value.clientHeight
  setViewport({ x: W / 2, y: H / 2, k: 80 })

  const svg = d3.select(svgRef.value)
  svg.on('mousemove', (event: MouseEvent) => handleMouseMove(event))
  svg.on('mouseup', (event: MouseEvent) => handleMouseUp(event))
  svg.on('mousedown', (event: MouseEvent) => handleMouseDown(event))
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
    setViewport({
      ...viewport.value,
      k: newK,
      x: sx - wx * newK,
      y: sy + wy * newK,
    })
    // Immediate redraw for responsive scroll — cancel pending debounced render
    if (renderTimer) clearTimeout(renderTimer)
    renderTimer = null
    drawAll()
  })

  watch(
    [
      () => structure.nodes,
      () => structure.members,
      () => structure.selectedNodeIds,
      () => structure.selectedMemberIds,
      () => structure.pendingMemberStartNodeId,
      () => loads.loads,
      () => solver.result,
      () => solver.showDeformed,
      () => solver.deformedScale,
      () => viewport.value,
      () => activeTool.value,
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
  <div class="w-full h-full relative">
    <svg ref="svgRef" id="structure-canvas" class="w-full h-full bg-white" :style="{ cursor: canvasCursor }" />
    <div v-if="selectionRect" :style="selectionOverlayStyle" />
  </div>
</template>
