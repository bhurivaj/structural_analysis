import * as THREE from 'three'
import type { SceneManager } from './SceneManager'

export class GridRenderer {
  private scene: THREE.Scene
  private gridHelper: THREE.GridHelper | null = null
  private originMarker: THREE.LineSegments | null = null
  private lastWorkplaneY: number = NaN

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  update(_sceneMan: SceneManager, workplaneY = 0) {
    if (this.lastWorkplaneY === workplaneY) return
    this.lastWorkplaneY = workplaneY

    // Grid: horizontal XZ plane at Y = workplaneY
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper)
      this.gridHelper.geometry.dispose()
      ;(this.gridHelper.material as THREE.Material).dispose()
    }
    this.gridHelper = new THREE.GridHelper(1000, 1000, 0x94a3b8, 0xe2e8f0)
    this.gridHelper.position.y = workplaneY
    this.gridHelper.renderOrder = -1
    this.scene.add(this.gridHelper)

    // Origin crosshair (X and Z axes) at workplane elevation
    if (this.originMarker) {
      this.scene.remove(this.originMarker)
      this.originMarker.geometry.dispose()
      ;(this.originMarker.material as THREE.Material).dispose()
    }
    const e = 0.01  // tiny Y offset so it renders above the grid
    const pos = new Float32Array([
      -0.5, workplaneY + e, 0,   0.5, workplaneY + e, 0,
       0, workplaneY + e, -0.5,  0, workplaneY + e, 0.5,
    ])
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.originMarker = new THREE.LineSegments(
      geo, new THREE.LineBasicMaterial({ color: 0xf59e0b })
    )
    this.originMarker.renderOrder = 0
    this.scene.add(this.originMarker)
  }

  dispose() {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper)
      this.gridHelper.geometry.dispose()
      ;(this.gridHelper.material as THREE.Material).dispose()
    }
    if (this.originMarker) {
      this.scene.remove(this.originMarker)
      this.originMarker.geometry.dispose()
      ;(this.originMarker.material as THREE.Material).dispose()
    }
  }
}
