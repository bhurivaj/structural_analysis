import * as THREE from 'three'
import type { StructureNode, Member } from '@/types/structure'

const C_NODE = new THREE.Color(0x1e293b)
const C_NODE_SEL = new THREE.Color(0x2563eb)
const C_NODE_GLOW = new THREE.Color(0xbfdbfe)
const C_MEMBER = new THREE.Color(0x475569)
const C_MEMBER_SEL = new THREE.Color(0x3b82f6)
const C_TENSION = new THREE.Color(0xf97316)
const C_DEFORMED = new THREE.Color(0x3b82f6)

export class StructureRenderer {
  private scene: THREE.Scene
  private nodePoints: THREE.Points | null = null
  private nodeGlow: THREE.Points | null = null
  private memberLines: THREE.LineSegments | null = null
  private memberSelectionLines: THREE.LineSegments | null = null
  private deformedLines: THREE.LineSegments | null = null
  private ghostLine: THREE.Line | null = null
  private epHandles: THREE.Points | null = null
  private epHandleGlow: THREE.Points | null = null
  private epGhost: THREE.Line | null = null
  private snapRing: THREE.Points | null = null

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  update(
    nodes: StructureNode[],
    members: Member[],
    selectedNodeIds: string[],
    selectedMemberIds: string[],
    deformedPositions?: Map<string, { ux: number; uy: number; uz: number }>,
    deformedScale = 1
  ) {
    this.updateNodes(nodes, selectedNodeIds)
    this.updateMembers(members, nodes, selectedMemberIds)
    this.updateDeformed(members, nodes, deformedPositions, deformedScale)
  }

  private updateNodes(nodes: StructureNode[], selectedNodeIds: string[]) {
    this.remove(this.nodePoints)
    this.remove(this.nodeGlow)
    this.nodePoints = null
    this.nodeGlow = null
    if (!nodes.length) return

    const pos = new Float32Array(nodes.length * 3)
    const col = new Float32Array(nodes.length * 3)
    const sel = new Set(selectedNodeIds)

    nodes.forEach((n, i) => {
      pos[i * 3] = n.x; pos[i * 3 + 1] = n.y; pos[i * 3 + 2] = n.z ?? 0
      const c = sel.has(n.id) ? C_NODE_SEL : C_NODE
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const mat = new THREE.PointsMaterial({ size: 8, sizeAttenuation: false, vertexColors: true })
    this.nodePoints = new THREE.Points(geo, mat)
    this.nodePoints.renderOrder = 2
    this.scene.add(this.nodePoints)

    // Node glow ring for selected nodes
    const selectedNodes = nodes.filter(n => sel.has(n.id))
    if (selectedNodes.length > 0) {
      const glowPos = new Float32Array(selectedNodes.length * 3)
      selectedNodes.forEach((n, i) => {
        glowPos[i * 3] = n.x
        glowPos[i * 3 + 1] = n.y
        glowPos[i * 3 + 2] = n.z ?? 0
      })
      const glowGeo = new THREE.BufferGeometry()
      glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3))
      const glowMat = new THREE.PointsMaterial({
        size: 20,
        sizeAttenuation: false,
        color: C_NODE_GLOW,
        transparent: true,
        opacity: 0.6,
        depthTest: false
      })
      this.nodeGlow = new THREE.Points(glowGeo, glowMat)
      this.nodeGlow.renderOrder = 1
      this.scene.add(this.nodeGlow)
    }
  }

  private updateMembers(members: Member[], nodes: StructureNode[], selectedMemberIds: string[]) {
    this.remove(this.memberLines)
    this.remove(this.memberSelectionLines)
    this.memberLines = null
    this.memberSelectionLines = null
    if (!members.length) return

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const sel = new Set(selectedMemberIds)

    // Pass A: Unselected members only
    const unselectedMembers: Member[] = []
    const unselectedPos: number[] = []
    const unselectedCol: number[] = []

    members.forEach((m) => {
      if (sel.has(m.id)) return // Skip selected, will be drawn in passes B+C

      const n1 = nodeMap.get(m.startNodeId)
      const n2 = nodeMap.get(m.endNodeId)
      if (!n1 || !n2) return

      unselectedMembers.push(m)
      unselectedPos.push(n1.x, n1.y, n1.z ?? 0, n2.x, n2.y, n2.z ?? 0)

      const c = m.tensionOnly ? C_TENSION : C_MEMBER
      unselectedCol.push(c.r, c.g, c.b, c.r, c.g, c.b)
    })

    if (unselectedMembers.length > 0) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(unselectedPos), 3))
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(unselectedCol), 3))
      this.memberLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true }))
      this.memberLines.renderOrder = 1
      this.scene.add(this.memberLines)
    }

    // Pass B: Selected members overlay — single pass, always on top
    if (selectedMemberIds.length > 0) {
      const selPos: number[] = []
      const selMembers: Member[] = []

      members.forEach((m) => {
        if (!sel.has(m.id)) return
        const n1 = nodeMap.get(m.startNodeId)
        const n2 = nodeMap.get(m.endNodeId)
        if (!n1 || !n2) return
        selMembers.push(m)
        selPos.push(n1.x, n1.y, n1.z ?? 0, n2.x, n2.y, n2.z ?? 0)
      })

      if (selMembers.length > 0) {
        const selCols = new Float32Array(selMembers.length * 6)
        for (let i = 0; i < selCols.length; i += 6) {
          selCols[i] = C_MEMBER_SEL.r; selCols[i + 1] = C_MEMBER_SEL.g; selCols[i + 2] = C_MEMBER_SEL.b
          selCols[i + 3] = C_MEMBER_SEL.r; selCols[i + 4] = C_MEMBER_SEL.g; selCols[i + 5] = C_MEMBER_SEL.b
        }
        const geoSel = new THREE.BufferGeometry()
        geoSel.setAttribute('position', new THREE.BufferAttribute(new Float32Array(selPos), 3))
        geoSel.setAttribute('color', new THREE.BufferAttribute(selCols, 3))
        const matSel = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, depthWrite: false })
        this.memberSelectionLines = new THREE.LineSegments(geoSel, matSel)
        this.memberSelectionLines.renderOrder = 20
        this.scene.add(this.memberSelectionLines)
      }
    }
  }

  private updateDeformed(
    members: Member[],
    nodes: StructureNode[],
    deformed?: Map<string, { ux: number; uy: number; uz: number }>,
    scale = 1
  ) {
    this.remove(this.deformedLines)
    this.deformedLines = null
    if (!deformed || !members.length) return

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const pos = new Float32Array(members.length * 6)

    members.forEach((m, i) => {
      const n1 = nodeMap.get(m.startNodeId)
      const n2 = nodeMap.get(m.endNodeId)
      if (!n1 || !n2) return
      const d1 = deformed.get(m.startNodeId)
      const d2 = deformed.get(m.endNodeId)
      const b = i * 6
      pos[b] = n1.x + (d1?.ux ?? 0) * scale
      pos[b + 1] = n1.y + (d1?.uy ?? 0) * scale
      pos[b + 2] = (n1.z ?? 0) + (d1?.uz ?? 0) * scale
      pos[b + 3] = n2.x + (d2?.ux ?? 0) * scale
      pos[b + 4] = n2.y + (d2?.uy ?? 0) * scale
      pos[b + 5] = (n2.z ?? 0) + (d2?.uz ?? 0) * scale
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.LineDashedMaterial({ color: C_DEFORMED, dashSize: 0.3, gapSize: 0.2 })
    this.deformedLines = new THREE.LineSegments(geo, mat)
    this.deformedLines.computeLineDistances()
    this.deformedLines.renderOrder = 1
    this.scene.add(this.deformedLines)
  }

  setGhostLine(start: { x: number; y: number; z?: number } | null, end: { x: number; y: number; z?: number } | null) {
    this.remove(this.ghostLine); this.ghostLine = null
    if (!start || !end) return
    const geo = new THREE.BufferGeometry()
    const sz = (start.z ?? 0) + 0.05, ez = (end.z ?? 0) + 0.05
    geo.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([start.x, start.y, sz, end.x, end.y, ez]), 3
    ))
    const mat = new THREE.LineDashedMaterial({ color: 0x3b82f6, dashSize: 0.25, gapSize: 0.12 })
    this.ghostLine = new THREE.Line(geo, mat)
    this.ghostLine.computeLineDistances()
    this.ghostLine.renderOrder = 3
    this.scene.add(this.ghostLine)
  }

  setEpHandles(positions: Array<{ x: number; y: number; z?: number }>) {
    this.remove(this.epHandles); this.epHandles = null
    this.remove(this.epHandleGlow); this.epHandleGlow = null
    if (!positions.length) return

    const pos = new Float32Array(positions.length * 3)
    positions.forEach((p, i) => { pos[i*3] = p.x; pos[i*3+1] = p.y; pos[i*3+2] = p.z ?? 0 })

    const geoGlow = new THREE.BufferGeometry()
    geoGlow.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3))
    this.epHandleGlow = new THREE.Points(geoGlow, new THREE.PointsMaterial({
      size: 24, sizeAttenuation: false, color: C_NODE_GLOW, transparent: true, opacity: 0.6, depthTest: false
    }))
    this.epHandleGlow.renderOrder = 1
    this.scene.add(this.epHandleGlow)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3))
    this.epHandles = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 14, sizeAttenuation: false, color: C_NODE_SEL, depthTest: false
    }))
    this.epHandles.renderOrder = 21
    this.scene.add(this.epHandles)
  }

  setEpGhost(fixed: { x: number; y: number; z?: number } | null, drag: { x: number; y: number; z?: number } | null) {
    this.remove(this.epGhost); this.epGhost = null
    if (!fixed || !drag) return
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([
        fixed.x, fixed.y, (fixed.z ?? 0) + 0.05,
        drag.x, drag.y, (drag.z ?? 0) + 0.05,
      ]), 3
    ))
    const mat = new THREE.LineDashedMaterial({ color: 0x3b82f6, dashSize: 0.25, gapSize: 0.12 })
    this.epGhost = new THREE.Line(geo, mat)
    this.epGhost.computeLineDistances()
    this.epGhost.renderOrder = 3
    this.scene.add(this.epGhost)
  }

  setSnapRing(pos: { x: number; y: number; z?: number } | null) {
    this.remove(this.snapRing); this.snapRing = null
    if (!pos) return
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([pos.x, pos.y, (pos.z ?? 0) + 0.1]), 3))
    this.snapRing = new THREE.Points(geo, new THREE.PointsMaterial({ size: 20, sizeAttenuation: false, color: 0x2563eb }))
    this.snapRing.renderOrder = 4
    this.scene.add(this.snapRing)
  }

  private remove(obj: THREE.Object3D | null) {
    if (!obj) return
    this.scene.remove(obj)
    if (obj instanceof THREE.Points || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
      obj.geometry.dispose()
      ;(obj.material as THREE.Material).dispose()
    }
  }

  dispose() {
    this.remove(this.nodePoints)
    this.remove(this.nodeGlow)
    this.remove(this.memberLines)
    this.remove(this.memberSelectionLines)
    this.remove(this.deformedLines)
    this.setGhostLine(null, null)
    this.setEpHandles([])
    this.remove(this.epHandleGlow)
    this.setEpGhost(null, null)
    this.setSnapRing(null)
  }
}
