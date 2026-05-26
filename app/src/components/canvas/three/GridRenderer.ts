import * as THREE from 'three'
import type { SceneManager } from './SceneManager'

export class GridRenderer {
  private scene: THREE.Scene
  private gridLines: THREE.LineSegments | null = null
  private originMarker: THREE.LineSegments | null = null
  private lastMode: string | null = null
  private lastZ: number = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.buildOriginMarker()
  }

  private buildOriginMarker() {
    const pos = new Float32Array([
      -0.4, 0, 0.02,  0.4, 0, 0.02,
       0, -0.4, 0.02,  0, 0.4, 0.02,
    ])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.originMarker = new THREE.LineSegments(
      geo, new THREE.LineBasicMaterial({ color: 0xf59e0b })
    )
    this.originMarker.renderOrder = 0
    this.scene.add(this.originMarker)
  }

  update(sceneMan: SceneManager, workplaneZ = 0) {
    if (sceneMan.mode === '3d') {
      const needRebuild = this.lastMode !== '3d' || this.lastZ !== workplaneZ
      if (needRebuild) {
        this.remove(this.gridLines)
        const helper = new THREE.GridHelper(100, 100, 0x94a3b8, 0xe2e8f0)
        // No rotation — GridHelper lies in XZ plane by default (horizontal, visible from TOP)
        helper.position.y = workplaneZ    // slide to floor elevation
        helper.renderOrder = -1
        this.gridLines = helper
        this.scene.add(this.gridLines)
        this.lastMode = '3d'
        this.lastZ = workplaneZ
      }
      return
    }

    this.remove(this.gridLines)
    this.gridLines = null
    this.lastMode = '2d'

    const cam = sceneMan.camera as THREE.OrthographicCamera
    const target = sceneMan.controls.target
    const visW = (cam.right - cam.left) / cam.zoom
    const visH = (cam.top - cam.bottom) / cam.zoom
    const cx = target.x, cy = target.y

    // Adaptive step: power of 2, ~10 divisions visible
    const rawStep = visH / 10
    const step = Math.max(0.001, Math.pow(2, Math.round(Math.log2(rawStep))))

    const pad = step * 2
    const minX = cx - visW / 2 - pad
    const maxX = cx + visW / 2 + pad
    const minY = cy - visH / 2 - pad
    const maxY = cy + visH / 2 + pad

    const x0 = Math.floor(minX / step) * step
    const y0 = Math.floor(minY / step) * step

    const verts: number[] = []
    for (let x = x0; x <= maxX + 1e-9; x += step) {
      verts.push(x, minY, 0,  x, maxY, 0)
    }
    for (let y = y0; y <= maxY + 1e-9; y += step) {
      verts.push(minX, y, 0,  maxX, y, 0)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3))
    this.gridLines = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.8 })
    )
    this.gridLines.renderOrder = -1
    this.scene.add(this.gridLines)
  }

  dispose() {
    this.remove(this.gridLines)
    this.remove(this.originMarker)
  }

  private remove(obj: THREE.Object3D | null) {
    if (!obj) return
    this.scene.remove(obj)
    if (obj instanceof THREE.LineSegments) {
      obj.geometry.dispose()
      ;(obj.material as THREE.Material).dispose()
    }
  }
}
