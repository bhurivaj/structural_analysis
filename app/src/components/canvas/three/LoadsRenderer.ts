import * as THREE from 'three'
import type { PointLoad, DistributedLoad, MomentLoad } from '@/types/loads'
import type { StructureNode, Member } from '@/types/structure'

const C_FORCE = 0xef4444
const C_DIST = 0x7c3aed
const C_FORCE_SEL = 0xfbbf24
const C_DIST_SEL = 0xc084fc
const ARROW_MAX = 1.6
const ARROW_MIN = 0.45
const DIST_STEPS = 6

export class LoadsRenderer {
  private scene: THREE.Scene
  private objects: THREE.Object3D[] = []
  private loadPositions: Map<string, THREE.Vector3> = new Map()

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  update(
    pointLoads: PointLoad[],
    distLoads: DistributedLoad[],
    momentLoads: MomentLoad[],
    nodes: StructureNode[],
    members: Member[],
    selectedLoadId?: string | null
  ) {
    this.clear()
    this.loadPositions.clear()
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const memberMap = new Map(members.map(m => [m.id, m]))

    let maxF = 0
    for (const l of pointLoads) maxF = Math.max(maxF, Math.abs(l.fx), Math.abs(l.fy), Math.abs(l.fz ?? 0))
    for (const l of distLoads) maxF = Math.max(maxF, Math.abs(l.w1), Math.abs(l.w2))
    if (maxF < 1e-9) maxF = 1

    for (const load of pointLoads) this.renderPoint(load, nodeMap, maxF, selectedLoadId)
    for (const load of distLoads) this.renderDist(load, nodeMap, memberMap, maxF, selectedLoadId)
    for (const load of momentLoads) this.renderMoment(load, nodeMap, selectedLoadId)
  }

  private renderPoint(load: PointLoad, nodeMap: Map<string, StructureNode>, maxF: number, selectedLoadId?: string | null) {
    const node = nodeMap.get(load.nodeId)
    if (!node) return
    const np = new THREE.Vector3(node.x, node.y, node.z ?? 0)
    this.loadPositions.set(load.id, np.clone())

    for (const [f, axis] of [[load.fx, 0], [load.fy, 1], [load.fz ?? 0, 2]] as [number, number][]) {
      if (Math.abs(f) < 1e-9) continue
      const len = ARROW_MIN + (ARROW_MAX - ARROW_MIN) * (Math.abs(f) / maxF)
      const dir = new THREE.Vector3()
      dir.setComponent(axis, Math.sign(f))
      const tail = np.clone().sub(dir.clone().multiplyScalar(len))
      const isSelected = selectedLoadId === load.id
      this.arrow(tail, dir, len, isSelected ? C_FORCE_SEL : C_FORCE, load.id)
    }
  }

  private renderDist(
    load: DistributedLoad,
    nodeMap: Map<string, StructureNode>,
    memberMap: Map<string, Member>,
    maxF: number,
    selectedLoadId?: string | null
  ) {
    const member = memberMap.get(load.memberId)
    if (!member) return
    const n1 = nodeMap.get(member.startNodeId), n2 = nodeMap.get(member.endNodeId)
    if (!n1 || !n2) return

    const p1 = new THREE.Vector3(n1.x, n1.y, n1.z ?? 0)
    const p2 = new THREE.Vector3(n2.x, n2.y, n2.z ?? 0)
    const midpoint = p1.clone().lerp(p2, 0.5)
    this.loadPositions.set(load.id, midpoint.clone())

    const mDir = p2.clone().sub(p1).normalize()
    const basePerp: THREE.Vector3 = load.direction === 'global_y'
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(-mDir.y, mDir.x, 0)

    const maxW = Math.max(Math.abs(load.w1), Math.abs(load.w2))
    if (maxW < 1e-9) return

    const sign = load.w1 !== 0 ? Math.sign(load.w1) : Math.sign(load.w2)
    const tailPts: THREE.Vector3[] = []
    const isSelected = selectedLoadId === load.id

    for (let i = 0; i <= DIST_STEPS; i++) {
      const t = i / DIST_STEPS
      const w = load.w1 + (load.w2 - load.w1) * t
      const pos = p1.clone().lerp(p2, t)
      const len = ARROW_MIN * 0.5 + (ARROW_MAX * 0.75) * (Math.abs(w) / maxF)
      const dir = basePerp.clone().multiplyScalar(Math.abs(w) > 1e-9 ? Math.sign(w) : sign)
      const tail = pos.clone().sub(dir.clone().multiplyScalar(len))
      tailPts.push(tail.clone())
      if (Math.abs(w) > 1e-9) this.arrow(tail, dir, len, isSelected ? C_DIST_SEL : C_DIST, load.id)
    }

    this.polyLine(tailPts, isSelected ? C_DIST_SEL : C_DIST, load.id)
    this.polyLine([p1, p2], isSelected ? C_DIST_SEL : C_DIST, load.id)
  }

  private renderMoment(load: MomentLoad, nodeMap: Map<string, StructureNode>, selectedLoadId?: string | null) {
    const node = nodeMap.get(load.nodeId)
    if (!node) return
    const nodePos = new THREE.Vector3(node.x, node.y, node.z ?? 0)
    this.loadPositions.set(load.id, nodePos.clone())

    const geo = new THREE.TorusGeometry(0.5, 0.07, 6, 24, Math.PI * 1.5)
    const isSelected = selectedLoadId === load.id
    const mat = new THREE.MeshBasicMaterial({ color: isSelected ? C_FORCE_SEL : C_FORCE, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(geo, mat)
    ring.position.set(node.x, node.y, (node.z ?? 0) + 0.05)
    ring.rotation.x = Math.PI / 2
    if (load.mz < 0) ring.rotation.z = Math.PI
    ring.renderOrder = 3
    ring.userData = { type: 'load', id: load.id }
    this.add(ring)
  }

  private arrow(origin: THREE.Vector3, dir: THREE.Vector3, len: number, color: number, loadId: string) {
    const hLen = Math.min(len * 0.3, 0.45)
    const arr = new THREE.ArrowHelper(dir.normalize(), origin, len, color, hLen, hLen * 0.7)
    arr.renderOrder = 3
    arr.userData = { type: 'load', id: loadId }
    this.add(arr)
  }

  private polyLine(pts: THREE.Vector3[], color: number, loadId: string) {
    if (pts.length < 2) return
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = new THREE.LineBasicMaterial({ color, opacity: 0.5, transparent: true })
    const line = new THREE.Line(geo, mat)
    line.renderOrder = 2
    line.userData = { type: 'load', id: loadId }
    this.add(line)
  }

  private add(obj: THREE.Object3D) {
    this.objects.push(obj)
    this.scene.add(obj)
  }

  private clear() {
    for (const obj of this.objects) {
      this.scene.remove(obj)
      obj.traverse(child => {
        const c = child as THREE.Mesh | THREE.Line
        if (c.geometry) c.geometry.dispose()
        const mat = c.material
        if (mat) Array.isArray(mat) ? mat.forEach(m => m.dispose()) : (mat as THREE.Material).dispose()
      })
    }
    this.objects = []
  }

  getLoadPositions(): Array<{ id: string; worldPos: THREE.Vector3 }> {
    return Array.from(this.loadPositions, ([id, worldPos]) => ({ id, worldPos }))
  }

  dispose() { this.clear() }
}
