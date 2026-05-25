import * as THREE from 'three'
import type { SceneManager } from '@/components/canvas/three/SceneManager'
import type { StructureNode, Member } from '@/types/structure'

const _raycaster = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
const _pt = new THREE.Vector3()

export function clientToWorld(
  clientX: number, clientY: number,
  scene: SceneManager, canvas: HTMLElement
): { x: number; y: number } | null {
  const cr = canvas.getBoundingClientRect()
  _ndc.set(
    ((clientX - cr.left) / cr.width) * 2 - 1,
    -((clientY - cr.top) / cr.height) * 2 + 1
  )
  _raycaster.setFromCamera(_ndc, scene.camera)
  if (!_raycaster.ray.intersectPlane(_plane, _pt)) return null
  return { x: _pt.x, y: _pt.y }
}

export function worldPixelSize(scene: SceneManager, canvas: HTMLElement, px: number): number {
  const h = canvas.clientHeight
  if (!h) return 0.3
  if (scene.mode === '2d') {
    const oc = scene.camera as THREE.OrthographicCamera
    const worldH = (oc.top - oc.bottom) / oc.zoom
    return px * worldH / h
  }
  const pc = scene.camera as THREE.PerspectiveCamera
  const dist = scene.controls.target.distanceTo(pc.position)
  const worldH = 2 * dist * Math.tan((pc.fov * Math.PI / 180) / 2)
  return px * worldH / h
}

export function hitNode(
  wx: number, wy: number,
  nodes: StructureNode[],
  thr: number
): string | null {
  let best: string | null = null
  let bestD = Infinity
  for (const n of nodes) {
    const d = Math.hypot(n.x - wx, n.y - wy)
    if (d < thr && d < bestD) { bestD = d; best = n.id }
  }
  return best
}

export function hitMember(
  wx: number, wy: number,
  members: Member[],
  nodeById: (id: string) => StructureNode | undefined,
  thr: number
): string | null {
  let best: string | null = null
  let bestD = Infinity
  for (const m of members) {
    const n1 = nodeById(m.startNodeId)
    const n2 = nodeById(m.endNodeId)
    if (!n1 || !n2) continue
    const d = distPtSeg(wx, wy, n1.x, n1.y, n2.x, n2.y)
    if (d < thr && d < bestD) { bestD = d; best = m.id }
  }
  return best
}

function distPtSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-12) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

function segCross(ax: number, ay: number, bx: number, by: number,
                  cx: number, cy: number, dx: number, dy: number): boolean {
  const cross = (ux: number, uy: number, vx: number, vy: number) => ux * vy - uy * vx
  const d1 = cross(bx-ax, by-ay, cx-ax, cy-ay)
  const d2 = cross(bx-ax, by-ay, dx-ax, dy-ay)
  const d3 = cross(dx-cx, dy-cy, ax-cx, ay-cy)
  const d4 = cross(dx-cx, dy-cy, bx-cx, by-cy)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
         ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

export function segIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  minX: number, minY: number, maxX: number, maxY: number
): boolean {
  if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) return true
  if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) return true
  return segCross(x1,y1,x2,y2, minX,minY,maxX,minY) ||
         segCross(x1,y1,x2,y2, maxX,minY,maxX,maxY) ||
         segCross(x1,y1,x2,y2, maxX,maxY,minX,maxY) ||
         segCross(x1,y1,x2,y2, minX,maxY,minX,minY)
}
