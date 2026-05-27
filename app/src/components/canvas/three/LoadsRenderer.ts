import * as THREE from 'three'
import type { PointLoad, DistributedLoad, MomentLoad } from '@/types/loads'
import type { StructureNode, Member } from '@/types/structure'

const C_FORCE = 0xef4444
const C_DIST = 0x7c3aed
const ARROW_MAX = 1.6   // arrow length at max force
const ARROW_MIN = 0.45  // minimum visible arrow length
const DIST_STEPS = 6

export class LoadsRenderer {
  private scene: THREE.Scene
  private objects: THREE.Object3D[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  update(
    pointLoads: PointLoad[],
    distLoads: DistributedLoad[],
    momentLoads: MomentLoad[],
    nodes: StructureNode[],
    members: Member[]
  ) {
    this.clear()
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const memberMap = new Map(members.map(m => [m.id, m]))

    // Global max force for consistent proportional scaling
    let maxF = 0
    for (const l of pointLoads) maxF = Math.max(maxF, Math.abs(l.fx), Math.abs(l.fy), Math.abs(l.fz ?? 0))
    for (const l of distLoads) maxF = Math.max(maxF, Math.abs(l.w1), Math.abs(l.w2))
    if (maxF < 1e-9) maxF = 1

    for (const load of pointLoads) this.renderPoint(load, nodeMap, maxF)
    for (const load of distLoads) this.renderDist(load, nodeMap, memberMap, maxF)
    for (const load of momentLoads) this.renderMoment(load, nodeMap)
  }

  private renderPoint(load: PointLoad, nodeMap: Map<string, StructureNode>, maxF: number) {
    const node = nodeMap.get(load.nodeId)
    if (!node) return
    const np = new THREE.Vector3(node.x, node.y, node.z ?? 0)

    for (const [f, axis] of [[load.fx, 0], [load.fy, 1], [load.fz ?? 0, 2]] as [number, number][]) {
      if (Math.abs(f) < 1e-9) continue
      const len = ARROW_MIN + (ARROW_MAX - ARROW_MIN) * (Math.abs(f) / maxF)
      const dir = new THREE.Vector3()
      dir.setComponent(axis, Math.sign(f))
      // Arrow head at node — tail offset in the opposite direction
      const tail = np.clone().sub(dir.clone().multiplyScalar(len))
      this.arrow(tail, dir, len, C_FORCE)
    }
  }

  private renderDist(
    load: DistributedLoad,
    nodeMap: Map<string, StructureNode>,
    memberMap: Map<string, Member>,
    maxF: number
  ) {
    const member = memberMap.get(load.memberId)
    if (!member) return
    const n1 = nodeMap.get(member.startNodeId), n2 = nodeMap.get(member.endNodeId)
    if (!n1 || !n2) return

    const p1 = new THREE.Vector3(n1.x, n1.y, n1.z ?? 0)
    const p2 = new THREE.Vector3(n2.x, n2.y, n2.z ?? 0)
    const mDir = p2.clone().sub(p1).normalize()

    const basePerp: THREE.Vector3 = load.direction === 'global_y'
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(-mDir.y, mDir.x, 0)

    const maxW = Math.max(Math.abs(load.w1), Math.abs(load.w2))
    if (maxW < 1e-9) return

    // Dominant sign for zero-crossing loads
    const sign = load.w1 !== 0 ? Math.sign(load.w1) : Math.sign(load.w2)
    const tailPts: THREE.Vector3[] = []

    for (let i = 0; i <= DIST_STEPS; i++) {
      const t = i / DIST_STEPS
      const w = load.w1 + (load.w2 - load.w1) * t
      const pos = p1.clone().lerp(p2, t)
      const len = ARROW_MIN * 0.5 + (ARROW_MAX * 0.75) * (Math.abs(w) / maxF)
      const dir = basePerp.clone().multiplyScalar(Math.abs(w) > 1e-9 ? Math.sign(w) : sign)
      // Head at member surface — tail offset away
      const tail = pos.clone().sub(dir.clone().multiplyScalar(len))
      tailPts.push(tail.clone())
      if (Math.abs(w) > 1e-9) this.arrow(tail, dir, len, C_DIST)
    }

    // Profile baseline connecting arrow tails (shows trapezoidal distribution)
    this.polyLine(tailPts, C_DIST)
    // Member baseline
    this.polyLine([p1, p2], C_DIST)
  }

  private renderMoment(load: MomentLoad, nodeMap: Map<string, StructureNode>) {
    const node = nodeMap.get(load.nodeId)
    if (!node) return
    const geo = new THREE.TorusGeometry(0.5, 0.07, 6, 24, Math.PI * 1.5)
    const mat = new THREE.MeshBasicMaterial({ color: C_FORCE, side: THREE.DoubleSide })
    const ring = new THREE.Mesh(geo, mat)
    ring.position.set(node.x, node.y, (node.z ?? 0) + 0.05)
    ring.rotation.x = Math.PI / 2
    if (load.mz < 0) ring.rotation.z = Math.PI
    ring.renderOrder = 3
    this.add(ring)
  }

  private arrow(origin: THREE.Vector3, dir: THREE.Vector3, len: number, color: number) {
    const hLen = Math.min(len * 0.3, 0.45)
    const arr = new THREE.ArrowHelper(dir.normalize(), origin, len, color, hLen, hLen * 0.7)
    arr.renderOrder = 3
    this.add(arr)
  }

  private polyLine(pts: THREE.Vector3[], color: number) {
    if (pts.length < 2) return
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = new THREE.LineBasicMaterial({ color, opacity: 0.5, transparent: true })
    const line = new THREE.Line(geo, mat)
    line.renderOrder = 2
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

  dispose() { this.clear() }
}
