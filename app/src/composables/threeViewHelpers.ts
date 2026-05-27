import type { SceneManager } from '@/components/canvas/three/SceneManager'
import type { StructureNode, Member } from '@/types/structure'
import { clientToWorld, clientToWorldXZ, segIntersectsRect } from './threeHitTest'

/** True when camera is roughly above (Y offset dominant = top view). */
export function isTopView(scene: SceneManager | null): boolean {
  if (!scene) return true
  const p = scene.camera.position, t = scene.controls.target
  const dy = Math.abs(p.y - t.y)
  return dy >= Math.abs(p.z - t.z) && dy >= Math.abs(p.x - t.x)
}

/** Project click to world using the appropriate plane for the current camera. */
export function toWorldOnPlane(
  clientX: number, clientY: number,
  scene: SceneManager, canvas: HTMLElement,
  workplaneZ: number, topView: boolean
) {
  return topView
    ? clientToWorldXZ(clientX, clientY, scene, canvas, workplaneZ)
    : clientToWorld(clientX, clientY, scene, canvas, workplaneZ)
}

/** Apply rubber-band box selection to nodes and members. */
export function applyRubberBandSelection(
  scene: SceneManager, canvas: HTMLElement,
  selStart: { cx: number; cy: number; topView: boolean },
  endX: number, endY: number,
  workplaneZ: number, isWindow: boolean,
  nodes: StructureNode[],
  members: Member[],
  nodeById: (id: string) => StructureNode | undefined,
  selectNode: (id: string, multi: boolean) => void,
  selectMember: (id: string, multi: boolean) => void
) {
  if (selStart.topView) {
    const tl = clientToWorldXZ(selStart.cx, selStart.cy, scene, canvas, workplaneZ)
    const br = clientToWorldXZ(endX, endY, scene, canvas, workplaneZ)
    if (!tl || !br) return
    const minX = Math.min(tl.x, br.x), maxX = Math.max(tl.x, br.x)
    const minZ = Math.min(tl.z, br.z), maxZ = Math.max(tl.z, br.z)
    for (const n of nodes) {
      if (n.x >= minX && n.x <= maxX && (n.z ?? 0) >= minZ && (n.z ?? 0) <= maxZ)
        selectNode(n.id, true)
    }
    for (const m of members) {
      const n1 = nodeById(m.startNodeId), n2 = nodeById(m.endNodeId)
      if (!n1 || !n2) continue
      const n1In = n1.x >= minX && n1.x <= maxX && (n1.z ?? 0) >= minZ && (n1.z ?? 0) <= maxZ
      const n2In = n2.x >= minX && n2.x <= maxX && (n2.z ?? 0) >= minZ && (n2.z ?? 0) <= maxZ
      const hit = isWindow ? (n1In && n2In) : segIntersectsRect(n1.x, n1.z ?? 0, n2.x, n2.z ?? 0, minX, minZ, maxX, maxZ)
      if (hit) selectMember(m.id, true)
    }
  } else {
    const tl = clientToWorld(selStart.cx, selStart.cy, scene, canvas)
    const br = clientToWorld(endX, endY, scene, canvas)
    if (!tl || !br) return
    const minX = Math.min(tl.x, br.x), maxX = Math.max(tl.x, br.x)
    const minY = Math.min(tl.y, br.y), maxY = Math.max(tl.y, br.y)
    for (const n of nodes) {
      if (n.x >= minX && n.x <= maxX && n.y >= minY && n.y <= maxY) selectNode(n.id, true)
    }
    for (const m of members) {
      const n1 = nodeById(m.startNodeId), n2 = nodeById(m.endNodeId)
      if (!n1 || !n2) continue
      const n1In = n1.x >= minX && n1.x <= maxX && n1.y >= minY && n1.y <= maxY
      const n2In = n2.x >= minX && n2.x <= maxX && n2.y >= minY && n2.y <= maxY
      const hit = isWindow ? (n1In && n2In) : segIntersectsRect(n1.x, n1.y, n2.x, n2.y, minX, minY, maxX, maxY)
      if (hit) selectMember(m.id, true)
    }
  }
}
