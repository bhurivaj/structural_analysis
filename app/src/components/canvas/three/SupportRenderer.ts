import * as THREE from 'three'
import type { StructureNode } from '@/types/structure'
import type { RollerAxis } from '@/types/structure'

const R = 0.52
const C_PIN    = 0x2563eb   // blue-600
const C_FIXED  = 0x1e293b   // slate-900
const C_ROLLER = 0x0891b2   // cyan-600
const C_HINGE  = 0xf59e0b   // amber-500 — hinge ring accent
const C_GROUND = 0x64748b   // slate-500

export class SupportRenderer {
  private scene: THREE.Scene
  private objects: THREE.Object3D[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  update(nodes: StructureNode[]) {
    this.clear()
    for (const n of nodes) {
      if (n.support === 'free') continue
      const z = n.z ?? 0
      if (n.support === 'pinned') this.pin(n.x, n.y, z)
      else if (n.support === 'fixed') this.fixed(n.x, n.y, z)
      else if (n.support === 'roller') this.roller(n.x, n.y, z, n.rollerAxis ?? 'y')
    }
  }

  // ── Pin ────────────────────────────────────────────────────────────────────

  private pin(x: number, y: number, z: number) {
    const coneH = R, coneR = R * 0.62

    // Inverted cone: ConeGeometry default has apex at (0, +h/2, 0), base at (0, -h/2, 0)
    // apex at node (x,y,z), base spreading downward → no rotation needed
    const coneGeo = new THREE.ConeGeometry(coneR, coneH, 8)
    const cone = mkMesh(coneGeo, C_PIN, 0.92)
    cone.position.set(x, y - coneH / 2, z)
    this.add(cone)

    // Amber hinge ring at node (XZ plane)
    const hingeGeo = new THREE.TorusGeometry(coneR * 0.38, R * 0.045, 4, 16)
    const hinge = mkMesh(hingeGeo, C_HINGE)
    hinge.rotation.x = Math.PI / 2
    hinge.position.set(x, y, z)
    this.add(hinge)

    // Ground disc
    const discGeo = new THREE.CylinderGeometry(coneR * 1.3, coneR * 1.3, R * 0.06, 16)
    const disc = mkMesh(discGeo, C_GROUND)
    disc.position.set(x, y - coneH - R * 0.03, z)
    this.add(disc)
  }

  // ── Fixed ──────────────────────────────────────────────────────────────────

  private fixed(x: number, y: number, z: number) {
    const hw = R * 0.68, hh = R * 0.52

    // Solid block
    const blockGeo = new THREE.BoxGeometry(hw * 2, hh * 2, hw * 2)
    const block = mkMesh(blockGeo, C_FIXED, 0.9)
    block.position.set(x, y - hh, z)
    this.add(block)

    // Edge lines for clarity
    const edgesGeo = new THREE.EdgesGeometry(blockGeo)
    const edges = new THREE.LineSegments(
      edgesGeo,
      new THREE.LineBasicMaterial({ color: 0x0f172a })
    )
    edges.position.set(x, y - hh, z)
    edges.renderOrder = 2
    this.add(edges)

    // Wider ground plate below
    const plateGeo = new THREE.BoxGeometry(hw * 2.8, R * 0.055, hw * 2.8)
    const plate = mkMesh(plateGeo, C_GROUND)
    plate.position.set(x, y - hh * 2 - R * 0.03, z)
    this.add(plate)
  }

  // ── Roller ─────────────────────────────────────────────────────────────────

  private roller(x: number, y: number, z: number, axis: RollerAxis) {
    const coneH = R, coneR = R * 0.62

    // Same cone as pin (cyan colour = roller)
    const coneGeo = new THREE.ConeGeometry(coneR, coneH, 8)
    const cone = mkMesh(coneGeo, C_ROLLER, 0.92)
    cone.position.set(x, y - coneH / 2, z)
    this.add(cone)

    // Amber hinge ring
    const hingeGeo = new THREE.TorusGeometry(coneR * 0.38, R * 0.045, 4, 16)
    const hinge = mkMesh(hingeGeo, C_HINGE)
    hinge.rotation.x = Math.PI / 2
    hinge.position.set(x, y, z)
    this.add(hinge)

    // Rail plate + wheels below cone base
    const gY = y - coneH - R * 0.06
    const wr = R * 0.14, wh = R * 0.55

    if (axis === 'y') {
      // Free to slide in X/Z: elongated rail plate, wheels aligned along Z
      const railGeo = new THREE.BoxGeometry(coneR * 3.0, R * 0.055, coneR * 1.8)
      const rail = mkMesh(railGeo, C_GROUND)
      rail.position.set(x, gY, z)
      this.add(rail)
      // Two wheels (cylinders with axis along Z, spinning as X-direction motion)
      for (const dx of [-coneR * 0.6, coneR * 0.6]) {
        this.add(wheel(x + dx, gY + wr, z, wr, wh, 'z', C_GROUND))
      }
    } else if (axis === 'x') {
      // Free to slide in Y/Z: elongated in Z
      const railGeo = new THREE.BoxGeometry(coneR * 1.8, R * 0.055, coneR * 3.0)
      const rail = mkMesh(railGeo, C_GROUND)
      rail.position.set(x, gY, z)
      this.add(rail)
      for (const dz of [-coneR * 0.6, coneR * 0.6]) {
        this.add(wheel(x, gY + wr, z + dz, wr, wh, 'x', C_GROUND))
      }
    } else {
      // 'z': free to slide in X/Y: elongated in X
      const railGeo = new THREE.BoxGeometry(coneR * 3.0, R * 0.055, coneR * 1.8)
      const rail = mkMesh(railGeo, C_GROUND)
      rail.position.set(x, gY, z)
      this.add(rail)
      for (const dx of [-coneR * 0.6, coneR * 0.6]) {
        this.add(wheel(x + dx, gY + wr, z, wr, wh, 'z', C_GROUND))
      }
    }
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────

  private add(obj: THREE.Object3D) {
    obj.renderOrder = 1
    this.objects.push(obj)
    this.scene.add(obj)
  }

  private clear() {
    for (const obj of this.objects) {
      this.scene.remove(obj)
      obj.traverse(child => {
        const c = child as THREE.Mesh
        c.geometry?.dispose()
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose())
        else (c.material as THREE.Material | undefined)?.dispose()
      })
    }
    this.objects = []
  }

  dispose() { this.clear() }
}

// ── helpers ────────────────────────────────────────────────────────────────────

function mkMesh(geo: THREE.BufferGeometry, color: number, opacity = 1): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
  })
  return new THREE.Mesh(geo, mat)
}

/** Cylinder wheel at position, rolling along the given axis. */
function wheel(
  x: number, y: number, z: number,
  r: number, h: number,
  rollAxis: 'x' | 'z',
  color: number
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, h, 12)
  const m = mkMesh(geo, color, 0.85)
  if (rollAxis === 'z') {
    m.rotation.z = Math.PI / 2  // cylinder axis → X, wheel rolls along X
  } else {
    m.rotation.x = Math.PI / 2  // cylinder axis → Z, wheel rolls along Z
  }
  m.position.set(x, y, z)
  return m
}
