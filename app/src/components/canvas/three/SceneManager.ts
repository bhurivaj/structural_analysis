import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export type CameraMode = '2d' | '3d'

const INITIAL_FRUSTUM_H = 20

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  private orthoCamera: THREE.OrthographicCamera
  private perspCamera: THREE.PerspectiveCamera
  controls: OrbitControls
  private _mode: CameraMode = '2d'
  private container: HTMLElement
  private animId = 0
  private ro: ResizeObserver

  get camera(): THREE.Camera {
    return this._mode === '2d' ? this.orthoCamera : this.perspCamera
  }

  get mode(): CameraMode { return this._mode }

  constructor(container: HTMLElement) {
    this.container = container

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(0xffffff)
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'
    container.appendChild(this.renderer.domElement)

    const { width, height } = container.getBoundingClientRect()
    const a = width / Math.max(height, 1)

    this.orthoCamera = new THREE.OrthographicCamera(
      -INITIAL_FRUSTUM_H * a / 2, INITIAL_FRUSTUM_H * a / 2,
      INITIAL_FRUSTUM_H / 2, -INITIAL_FRUSTUM_H / 2, -1000, 1000
    )
    this.orthoCamera.position.set(0, 0, 10)

    this.perspCamera = new THREE.PerspectiveCamera(45, a, 0.01, 10000)
    this.perspCamera.position.set(15, 10, 15)
    this.perspCamera.lookAt(0, 0, 0)

    this.scene = new THREE.Scene()
    this.controls = this.makeControls()

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.resize()
    this.loop()
  }

  private makeControls(): OrbitControls {
    const c = new OrbitControls(this.camera, this.renderer.domElement)
    c.enableDamping = false
    c.screenSpacePanning = true
    c.zoomToCursor = true
    if (this._mode === '2d') {
      c.enableRotate = false
      c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    }
    return c
  }

  setMode(mode: CameraMode) {
    if (mode === this._mode) return
    const target = this.controls.target.clone()
    this.controls.dispose()
    this._mode = mode

    if (mode === '3d') {
      const dist = (this.orthoCamera.top - this.orthoCamera.bottom) * 1.2
      this.perspCamera.position.set(target.x + dist, target.y + dist * 0.7, dist)
      this.perspCamera.lookAt(target)
    } else {
      this.orthoCamera.position.set(target.x, target.y, 10)
      this.resize()
    }

    this.controls = this.makeControls()
    this.controls.target.copy(target)
    this.controls.update()
  }

  private resize() {
    const { width, height } = this.container.getBoundingClientRect()
    if (!width || !height) return
    this.renderer.setSize(width, height, false)
    const a = width / height
    const h = this.orthoCamera.top - this.orthoCamera.bottom
    this.orthoCamera.left = -h * a / 2
    this.orthoCamera.right = h * a / 2
    this.orthoCamera.updateProjectionMatrix()
    this.perspCamera.aspect = a
    this.perspCamera.updateProjectionMatrix()
  }

  private loop() {
    this.animId = requestAnimationFrame(() => this.loop())
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  fitToView(minX: number, maxX: number, minY: number, maxY: number) {
    const { clientWidth: w, clientHeight: h } = this.renderer.domElement
    const a = w / Math.max(h, 1)
    const rw = (maxX - minX) || 2
    const rh = (maxY - minY) || 2
    const pad = 1.4
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    if (this._mode === '2d') {
      const fh = Math.max(rh * pad, (rw * pad) / a)
      const fw = fh * a
      this.orthoCamera.left = -fw / 2; this.orthoCamera.right = fw / 2
      this.orthoCamera.top = fh / 2; this.orthoCamera.bottom = -fh / 2
      this.orthoCamera.zoom = 1
      this.orthoCamera.updateProjectionMatrix()
      this.controls.target.set(cx, cy, 0)
      this.orthoCamera.position.set(cx, cy, 10)
    } else {
      const dist = Math.max(rw, rh) * pad
      this.perspCamera.position.set(cx + dist * 0.8, cy + dist * 0.6, dist)
      this.controls.target.set(cx, cy, 0)
    }
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
