import * as THREE from 'three'
import type { PointLoad, DistributedLoad, MomentLoad } from '@/types/loads'
import type { StructureNode, Member } from '@/types/structure'

const C_FORCE = 0xef4444
const C_DIST = 0x7c3aed
const ARROW_LEN = 1.5
const DIST_STEPS = 5

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
    for (const load of pointLoads) this.renderPoint(load, nodeMap)
    for (const load of distLoads) this.renderDist(load, nodeMap, memberMap)
    for (const load of momentLoads) this.renderMoment(load, nodeMap)
  }

  private renderPoint(load: PointLoad, nodeMap: Map<string, StructureNode>) {
    const node = nodeMap.get(load.nodeId)
    if (!node) return
    const origin = new THREE.Vector3(node.x, node.y, node.z ?? 0)
    if (load.fx !== 0) this.arrow(origin, new THREE.Vector3(Math.sign(load.fx), 0, 0), ARROW_LEN, C_FORCE)
    if (load.fy !== 0) this.arrow(origin, new THREE.Vector3(0, Math.sign(load.fy), 0), ARROW_LEN, C_FORCE)
    if ((load.fz ?? 0) !== 0) this.arrow(origin, new THREE.Vector3(0, 0, Math.sign(load.fz!)), ARROW_LEN, C_FORCE)
  }

  private renderDist(load: DistributedLoad, nodeMap: Map<string, StructureNode>, memberMap: Map<string, Member>) {
    const member = memberMap.get(load.memberId)
    if (!member) return
    const n1 = nodeMap.get(member.startNodeId)
    const n2 = nodeMap.get(member.endNodeId)
    if (!n1 || !n2) return

    const p1 = new THREE.Vector3(n1.x, n1.y, n1.z ?? 0)
    const p2 = new THREE.Vector3(n2.x, n2.y, n2.z ?? 0)
    const mDir = p2.clone().sub(p1).normalize()

    // Base perpendicular direction (positive w = positive axis direction)
    const basePerp: THREE.Vector3 = load.direction === 'global_y'
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(-mDir.y, mDir.x, 0)

    const maxW = Math.max(Math.abs(load.w1), Math.abs(load.w2))
    if (maxW < 1e-9) return

    for (let i = 0; i <= DIST_STEPS; i++) {
      const t = i / DIST_STEPS
      const w = load.w1 + (load.w2 - load.w1) * t
      if (Math.abs(w) < 1e-9) continue
      const pos = p1.clone().lerp(p2, t)
      const len = Math.max(ARROW_LEN * 0.5 * (Math.abs(w) / maxW), 0.25)
      const dir = basePerp.clone().multiplyScalar(Math.sign(w))
      this.arrow(pos, dir, len, C_DIST)
    }
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
        if (mat) {
          Array.isArray(mat) ? mat.forEach(m => m.dispose()) : (mat as THREE.Material).dispose()
        }
      })
    }
    this.objects = []
  }

  dispose() { this.clear() }
}
