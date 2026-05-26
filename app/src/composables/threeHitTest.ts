import * as THREE from 'three'
import type { SceneManager } from '@/components/canvas/three/SceneManager'
import type { StructureNode, Member } from '@/types/structure'

const _raycaster = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
const _pt = new THREE.Vector3()

/** Project a world point to canvas pixel coordinates. */
export function projectToScreen(
  wx: number, wy: number, wz: number,
  cam: THREE.Camera, cr: DOMRect
): { sx: number; sy: number } {
  const v = new THREE.Vector3(wx, wy, wz).project(cam)
  return {
    sx: (v.x + 1) / 2 * cr.width + cr.left,
    sy: -(v.y - 1) / 2 * cr.height + cr.top,
  }
}

/** Unproject mouse to a vertical XY plane at the given Z. Used in 2D mode. */
export function clientToWorld(
  clientX: number, clientY: number,
  scene: SceneManager, canvas: HTMLElement,
  planeZ = 0
): { x: number; y: number; z: number } | null {
  const cr = canvas.getBoundingClientRect()
  _ndc.set(
    ((clientX - cr.left) / cr.width) * 2 - 1,
    -((clientY - cr.top) / cr.height) * 2 + 1
  )
  _raycaster.setFromCamera(_ndc, scene.camera)
  _plane.set(new THREE.Vector3(0, 0, 1), -planeZ)
  if (!_raycaster.ray.intersectPlane(_plane, _pt)) return null
  return { x: _pt.x, y: _pt.y, z: planeZ }
}

/** Unproject mouse to a horizontal XZ plane at the given Y elevation. Used in 3D mode. */
export function clientToWorldXZ(
  clientX: number, clientY: number,
  scene: SceneManager, canvas: HTMLElement,
  planeY = 0
): { x: number; y: number; z: number } | null {
  const cr = canvas.getBoundingClientRect()
  _ndc.set(
    ((clientX - cr.left) / cr.width) * 2 - 1,
    -((clientY - cr.top) / cr.height) * 2 + 1
  )
  _raycaster.setFromCamera(_ndc, scene.camera)
  _plane.set(new THREE.Vector3(0, 1, 0), -planeY)
  if (!_raycaster.ray.intersectPlane(_plane, _pt)) return null
  return { x: _pt.x, y: planeY, z: _pt.z }
}

/** @deprecated Use screen-space hit functions instead. */
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

/** Find the closest node within thrPx screen pixels of (clientX, clientY). */
export function hitNode(
  clientX: number, clientY: number,
  nodes: StructureNode[],
  scene: SceneManager,
  canvas: HTMLElement,
  thrPx = 10
): string | null {
  const cr = canvas.getBoundingClientRect()
  let best: string | null = null
  let bestD = Infinity
  for (const n of nodes) {
    const { sx, sy } = projectToScreen(n.x, n.y, n.z ?? 0, scene.camera, cr)
    const d = Math.hypot(clientX - sx, clientY - sy)
    if (d < thrPx && d < bestD) { bestD = d; best = n.id }
  }
  return best
}

/** Find the closest member whose projected segment is within thrPx of (clientX, clientY). */
export function hitMember(
  clientX: number, clientY: number,
  members: Member[],
  nodeById: (id: string) => StructureNode | undefined,
  scene: SceneManager,
  canvas: HTMLElement,
  thrPx = 15
): string | null {
  const cr = canvas.getBoundingClientRect()
  let best: string | null = null
  let bestD = Infinity
  for (const m of members) {
    const n1 = nodeById(m.startNodeId)
    const n2 = nodeById(m.endNodeId)
    if (!n1 || !n2) continue
    const p1 = projectToScreen(n1.x, n1.y, n1.z ?? 0, scene.camera, cr)
    const p2 = projectToScreen(n2.x, n2.y, n2.z ?? 0, scene.camera, cr)
    const d = distPtSeg(clientX, clientY, p1.sx, p1.sy, p2.sx, p2.sy)
    if (d < thrPx && d < bestD) { bestD = d; best = m.id }
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
