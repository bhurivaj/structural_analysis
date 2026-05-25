import * as THREE from 'three'
import type { StructureNode } from '@/types/structure'

const R = 0.5
const C_SUPPORT = new THREE.Color(0x0f172a)

export class SupportRenderer {
  private scene: THREE.Scene
  private lines: THREE.LineSegments | null = null

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  update(nodes: StructureNode[], mode: '2d' | '3d' = '2d') {
    this.remove()
    const verts: number[] = []
    for (const n of nodes) {
      if (n.support === 'free') continue
      const z = n.z ?? 0
      if (mode === '3d') {
        if (n.support === 'pinned') add3dPinned(verts, n.x, n.y, z)
        else if (n.support === 'fixed') add3dFixed(verts, n.x, n.y, z)
        else if (n.support === 'roller') add3dRoller(verts, n.x, n.y, z, n.rollerAxis ?? 'y')
      } else {
        if (n.support === 'pinned') addPinned(verts, n.x, n.y, z)
        else if (n.support === 'fixed') addFixed(verts, n.x, n.y, z)
        else if (n.support === 'roller') addRoller(verts, n.x, n.y, z, n.rollerAxis ?? 'y')
      }
    }
    if (!verts.length) return
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
    const mat = new THREE.LineBasicMaterial({ color: C_SUPPORT })
    this.lines = new THREE.LineSegments(geo, mat)
    this.lines.renderOrder = 1
    this.scene.add(this.lines)
  }

  private remove() {
    if (!this.lines) return
    this.scene.remove(this.lines)
    this.lines.geometry.dispose()
    ;(this.lines.material as THREE.Material).dispose()
    this.lines = null
  }

  dispose() { this.remove() }
}

// ── shared helpers ────────────────────────────────────────────────────────────

function seg(v: number[], x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) {
  v.push(x1, y1, z1, x2, y2, z2)
}

// polygon ring in XY plane at given z
function ring(v: number[], cx: number, cy: number, z: number, r: number, n = 8) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    v.push(cx + r * Math.cos(a0), cy + r * Math.sin(a0), z)
    v.push(cx + r * Math.cos(a1), cy + r * Math.sin(a1), z)
  }
}

// polygon ring in XZ plane (for Y-axis cylinders)
function ringXZ(v: number[], cx: number, cy: number, cz: number, r: number, n = 8) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    v.push(cx + r * Math.cos(a0), cy, cz + r * Math.sin(a0))
    v.push(cx + r * Math.cos(a1), cy, cz + r * Math.sin(a1))
  }
}

// polygon ring in YZ plane (for X-axis cylinders)
function ringYZ(v: number[], cx: number, cy: number, cz: number, r: number, n = 8) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    v.push(cx, cy + r * Math.cos(a0), cz + r * Math.sin(a0))
    v.push(cx, cy + r * Math.cos(a1), cz + r * Math.sin(a1))
  }
}

// ── 3D symbols ────────────────────────────────────────────────────────────────

function cone3d(v: number[], apexX: number, apexY: number, apexZ: number,
                baseY: number, baseR: number, n = 8) {
  ring(v, apexX, apexY + baseY, apexZ, baseR, n)  // base ring at baseY offset
  for (let i = 0; i < n; i += 2) {
    const a = (i / n) * Math.PI * 2
    const bx = apexX + baseR * Math.cos(a)
    const bz = apexZ + baseR * Math.sin(a)
    seg(v, apexX, apexY, apexZ, bx, apexY + baseY, bz)
  }
}

function plate3d(v: number[], cx: number, cy: number, cz: number, hw: number, hd: number) {
  // flat rectangular plate (XZ plane)
  seg(v, cx - hw, cy, cz - hd, cx + hw, cy, cz - hd)
  seg(v, cx + hw, cy, cz - hd, cx + hw, cy, cz + hd)
  seg(v, cx + hw, cy, cz + hd, cx - hw, cy, cz + hd)
  seg(v, cx - hw, cy, cz + hd, cx - hw, cy, cz - hd)
}

function cylinder3d(v: number[], cx: number, cy1: number, cy2: number, cz: number, r: number) {
  // cylinder along Y axis between cy1 and cy2
  ring(v, cx, cy1, cz, r)
  ring(v, cx, cy2, cz, r)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const px = cx + r * Math.cos(a), pz = cz + r * Math.sin(a)
    seg(v, px, cy1, pz, px, cy2, pz)
  }
}

function cylinderAlongX(v: number[], cx1: number, cx2: number, cy: number, cz: number, r: number) {
  // cylinder along X axis between cx1 and cx2
  ringYZ(v, cx1, cy, cz, r)
  ringYZ(v, cx2, cy, cz, r)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const py = cy + r * Math.cos(a), pz = cz + r * Math.sin(a)
    seg(v, cx1, py, pz, cx2, py, pz)
  }
}

function cylinderAlongZ(v: number[], cx: number, cy: number, cz1: number, cz2: number, r: number) {
  // cylinder along Z axis between cz1 and cz2
  ringXZ(v, cx, cy, cz1, r)
  ringXZ(v, cx, cy, cz2, r)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a)
    seg(v, px, py, cz1, px, py, cz2)
  }
}

function add3dPinned(v: number[], x: number, y: number, z: number) {
  // downward cone (apex at node)
  cone3d(v, x, y, z, -R * 1.2, R * 0.7)
  // hinge pin: short horizontal cylinder through apex
  cylinderAlongX(v, x - R * 0.25, x + R * 0.25, y, z, R * 0.1)
  // base plate
  plate3d(v, x, y - R * 1.2, z, R * 1.1, R * 1.1)
  // ground plate below
  plate3d(v, x, y - R * 1.5, z, R * 1.3, R * 1.3)
  // 4 legs from base plate to ground
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as [number, number][]) {
    seg(v, x + dx * R * 1.1, y - R * 1.2, z + dz * R * 1.1,
           x + dx * R * 1.3, y - R * 1.5, z + dz * R * 1.3)
  }
}

function add3dFixed(v: number[], x: number, y: number, z: number) {
  // anchor block (box)
  const hw = R * 0.9, hh = R * 0.5, hd = R * 0.9
  const y0 = y, y1 = y - hh * 2
  // 4 vertical edges
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as [number, number][]) {
    seg(v, x + dx * hw, y0, z + dz * hd, x + dx * hw, y1, z + dz * hd)
  }
  // top face
  seg(v, x - hw, y0, z - hd, x + hw, y0, z - hd)
  seg(v, x + hw, y0, z - hd, x + hw, y0, z + hd)
  seg(v, x + hw, y0, z + hd, x - hw, y0, z + hd)
  seg(v, x - hw, y0, z + hd, x - hw, y0, z - hd)
  // bottom face
  seg(v, x - hw, y1, z - hd, x + hw, y1, z - hd)
  seg(v, x + hw, y1, z - hd, x + hw, y1, z + hd)
  seg(v, x + hw, y1, z + hd, x - hw, y1, z + hd)
  seg(v, x - hw, y1, z + hd, x - hw, y1, z - hd)
  // X diagonals on front/back faces (fixed constraint hint)
  seg(v, x - hw, y0, z - hd, x + hw, y1, z - hd)
  seg(v, x + hw, y0, z - hd, x - hw, y1, z - hd)
  seg(v, x - hw, y0, z + hd, x + hw, y1, z + hd)
  seg(v, x + hw, y0, z + hd, x - hw, y1, z + hd)
  // ground plate
  plate3d(v, x, y1, z, R * 1.3, R * 1.3)
}

function add3dRoller(v: number[], x: number, y: number, z: number, axis: 'x' | 'y') {
  // cone
  cone3d(v, x, y, z, -R * 1.2, R * 0.7)
  // base plate
  plate3d(v, x, y - R * 1.2, z, R * 1.1, R * 1.1)

  const wr = R * 0.18  // wheel radius
  const wl = R * 0.5   // wheel half-length

  if (axis === 'y') {
    // two wheels rolling in X direction, offset in Z
    cylinderAlongX(v, x - wl, x + wl, y - R * 1.4, z - R * 0.4, wr)
    cylinderAlongX(v, x - wl, x + wl, y - R * 1.4, z + R * 0.4, wr)
    // rail
    plate3d(v, x, y - R * 1.62, z, R * 1.3, R * 1.3)
  } else {
    // two wheels rolling in Z direction (allow X movement)
    cylinderAlongZ(v, x - R * 0.4, y - R * 1.4, z - wl, z + wl, wr)
    cylinderAlongZ(v, x + R * 0.4, y - R * 1.4, z - wl, z + wl, wr)
    // rail
    plate3d(v, x, y - R * 1.62, z, R * 1.3, R * 1.3)
  }
}

// ── 2D symbols (unchanged) ────────────────────────────────────────────────────

function seg2(v: number[], x1: number, y1: number, z: number, x2: number, y2: number) {
  v.push(x1, y1, z, x2, y2, z)
}

function circle(v: number[], cx: number, cy: number, z: number, r: number, n = 10) {
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2
    v.push(cx + r * Math.cos(a0), cy + r * Math.sin(a0), z)
    v.push(cx + r * Math.cos(a1), cy + r * Math.sin(a1), z)
  }
}

function hatch(v: number[], baseY: number, x: number, z: number, count = 5) {
  for (let i = 0; i < count; i++) {
    const hx = x - R * 0.8 + i * R * 0.4
    seg2(v, hx, baseY, z, hx - R * 0.25, baseY - R * 0.5, z)
  }
}

function addPinned(v: number[], x: number, y: number, z: number) {
  seg2(v, x, y, z, x - R * 0.7, y - R, z)
  seg2(v, x, y, z, x + R * 0.7, y - R, z)
  seg2(v, x - R * 0.7, y - R, z, x + R * 0.7, y - R, z)
  seg2(v, x - R * 0.9, y - R, z, x + R * 0.9, y - R, z)
  seg2(v, x - R * 1.1, y - R * 1.25, z, x + R * 1.1, y - R * 1.25, z)
  hatch(v, y - R * 1.25, x, z)
}

function addFixed(v: number[], x: number, y: number, z: number) {
  seg2(v, x, y, z, x, y - R * 0.15, z)
  seg2(v, x - R * 1.1, y - R * 0.15, z, x + R * 1.1, y - R * 0.15, z)
  hatch(v, y - R * 0.15, x, z)
}

function addRoller(v: number[], x: number, y: number, z: number, axis: 'x' | 'y') {
  if (axis === 'y') {
    seg2(v, x, y, z, x - R * 0.7, y - R, z)
    seg2(v, x, y, z, x + R * 0.7, y - R, z)
    seg2(v, x - R * 0.7, y - R, z, x + R * 0.7, y - R, z)
    seg2(v, x - R * 0.9, y - R, z, x + R * 0.9, y - R, z)
    circle(v, x - R * 0.4, y - R * 1.15, z, R * 0.12)
    circle(v, x + R * 0.4, y - R * 1.15, z, R * 0.12)
    seg2(v, x - R * 1.1, y - R * 1.3, z, x + R * 1.1, y - R * 1.3, z)
    hatch(v, y - R * 1.3, x, z)
  } else {
    seg2(v, x, y, z, x - R, y + R * 0.7, z)
    seg2(v, x, y, z, x - R, y - R * 0.7, z)
    seg2(v, x - R, y - R * 0.7, z, x - R, y + R * 0.7, z)
    seg2(v, x - R, y - R * 0.9, z, x - R, y + R * 0.9, z)
    circle(v, x - R * 1.15, y - R * 0.4, z, R * 0.12)
    circle(v, x - R * 1.15, y + R * 0.4, z, R * 0.12)
    seg2(v, x - R * 1.3, y - R * 1.1, z, x - R * 1.3, y + R * 1.1, z)
    for (let i = 0; i < 5; i++) {
      const hy = y - R * 0.8 + i * R * 0.4
      seg2(v, x - R * 1.3, hy, z, x - R * 1.55, hy - R * 0.25, z)
    }
  }
}
