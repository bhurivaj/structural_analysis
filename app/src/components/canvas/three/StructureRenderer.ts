import * as THREE from 'three'
import type { StructureNode, Member } from '@/types/structure'

const C_NODE = new THREE.Color(0x1e293b)
const C_NODE_SEL = new THREE.Color(0x2563eb)
const C_MEMBER = new THREE.Color(0x475569)
const C_MEMBER_SEL = new THREE.Color(0x2563eb)
const C_TENSION = new THREE.Color(0xf97316)
const C_DEFORMED = new THREE.Color(0x3b82f6)

export class StructureRenderer {
  private scene: THREE.Scene
  private nodePoints: THREE.Points | null = null
  private memberLines: THREE.LineSegments | null = null
  private deformedLines: THREE.LineSegments | null = null

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  update(
    nodes: StructureNode[],
    members: Member[],
    selectedNodeIds: string[],
    selectedMemberIds: string[],
    deformedPositions?: Map<string, { ux: number; uy: number }>,
    deformedScale = 1
  ) {
    this.updateNodes(nodes, selectedNodeIds)
    this.updateMembers(members, nodes, selectedMemberIds)
    this.updateDeformed(members, nodes, deformedPositions, deformedScale)
  }

  private updateNodes(nodes: StructureNode[], selectedNodeIds: string[]) {
    this.remove(this.nodePoints)
    this.nodePoints = null
    if (!nodes.length) return

    const pos = new Float32Array(nodes.length * 3)
    const col = new Float32Array(nodes.length * 3)
    const sel = new Set(selectedNodeIds)

    nodes.forEach((n, i) => {
      pos[i * 3] = n.x; pos[i * 3 + 1] = n.y; pos[i * 3 + 2] = 0
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
  }

  private updateMembers(members: Member[], nodes: StructureNode[], selectedMemberIds: string[]) {
    this.remove(this.memberLines)
    this.memberLines = null
    if (!members.length) return

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const pos = new Float32Array(members.length * 6)
    const col = new Float32Array(members.length * 6)
    const sel = new Set(selectedMemberIds)

    members.forEach((m, i) => {
      const n1 = nodeMap.get(m.startNodeId)
      const n2 = nodeMap.get(m.endNodeId)
      if (!n1 || !n2) return
      const b = i * 6
      pos[b] = n1.x; pos[b + 1] = n1.y; pos[b + 2] = 0
      pos[b + 3] = n2.x; pos[b + 4] = n2.y; pos[b + 5] = 0
      const c = sel.has(m.id) ? C_MEMBER_SEL : m.tensionOnly ? C_TENSION : C_MEMBER
      col[b] = c.r; col[b + 1] = c.g; col[b + 2] = c.b
      col[b + 3] = c.r; col[b + 4] = c.g; col[b + 5] = c.b
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    this.memberLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true }))
    this.memberLines.renderOrder = 1
    this.scene.add(this.memberLines)
  }

  private updateDeformed(
    members: Member[],
    nodes: StructureNode[],
    deformed?: Map<string, { ux: number; uy: number }>,
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
      pos[b + 2] = 0.01
      pos[b + 3] = n2.x + (d2?.ux ?? 0) * scale
      pos[b + 4] = n2.y + (d2?.uy ?? 0) * scale
      pos[b + 5] = 0.01
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.LineDashedMaterial({ color: C_DEFORMED, dashSize: 0.3, gapSize: 0.2 })
    this.deformedLines = new THREE.LineSegments(geo, mat)
    this.deformedLines.computeLineDistances()
    this.deformedLines.renderOrder = 1
    this.scene.add(this.deformedLines)
  }

  private remove(obj: THREE.Object3D | null) {
    if (!obj) return
    this.scene.remove(obj)
    if (obj instanceof THREE.Points || obj instanceof THREE.LineSegments) {
      obj.geometry.dispose()
      ;(obj.material as THREE.Material).dispose()
    }
  }

  dispose() {
    this.remove(this.nodePoints)
    this.remove(this.memberLines)
    this.remove(this.deformedLines)
  }
}
