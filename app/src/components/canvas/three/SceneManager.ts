import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const INITIAL_FRUSTUM_H = 20 // world units visible initially

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.OrthographicCamera
  readonly controls: OrbitControls
  private animId = 0
  private ro: ResizeObserver

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0xffffff)
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'
    container.appendChild(this.renderer.domElement)

    const { width, height } = container.getBoundingClientRect()
    const a = width / Math.max(height, 1)
    const h = INITIAL_FRUSTUM_H
    this.camera = new THREE.OrthographicCamera(-h * a / 2, h * a / 2, h / 2, -h / 2, -1000, 1000)
    this.camera.position.set(0, 0, 10)

    this.scene = new THREE.Scene()

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableRotate = false
    this.controls.enableDamping = false
    this.controls.screenSpacePanning = true
    this.controls.zoomToCursor = true

    this.ro = new ResizeObserver(() => this.resize(container))
    this.ro.observe(container)
    this.resize(container)
    this.loop()
  }

  private resize(container: HTMLElement) {
    const { width, height } = container.getBoundingClientRect()
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    const a = width / height
    const h = this.camera.top - this.camera.bottom
    this.camera.left = -h * a / 2
    this.camera.right = h * a / 2
    this.camera.updateProjectionMatrix()
  }

  private loop() {
    this.animId = requestAnimationFrame(() => this.loop())
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  fitToView(minX: number, maxX: number, minY: number, maxY: number) {
    const w = this.renderer.domElement.clientWidth
    const h = this.renderer.domElement.clientHeight
    const a = w / Math.max(h, 1)
    const rw = (maxX - minX) || 2
    const rh = (maxY - minY) || 2
    const pad = 1.4
    const fh = Math.max(rh * pad, (rw * pad) / a)
    const fw = fh * a
    this.camera.left = -fw / 2
    this.camera.right = fw / 2
    this.camera.top = fh / 2
    this.camera.bottom = -fh / 2
    this.camera.zoom = 1
    this.camera.updateProjectionMatrix()
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    this.controls.target.set(cx, cy, 0)
    this.camera.position.set(cx, cy, 10)
    this.controls.update()
  }

  snapshot(): string {
    this.renderer.render(this.scene, this.camera)
    return this.renderer.domElement.toDataURL('image/png')
  }

  dispose() {
    cancelAnimationFrame(this.animId)
    this.ro.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
