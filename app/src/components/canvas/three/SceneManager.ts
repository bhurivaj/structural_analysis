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
  private frameCallbacks: Array<() => void> = []
  private axesHelper: THREE.AxesHelper | null = null

  get camera(): THREE.Camera {
    return this._mode === '2d' ? this.orthoCamera : this.perspCamera
  }

  get mode(): CameraMode { return this._mode }

  get orthoZoom(): number { return this.orthoCamera.zoom }

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
    this.perspCamera.position.set(5, 7, 20)
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
      // Place camera mostly along +Z so X→screen-right, Y→screen-up (XY plane face-on)
      this.perspCamera.position.set(target.x + dist * 0.2, target.y + dist * 0.3, target.z + dist)
      this.perspCamera.lookAt(target)
      this.axesHelper = new THREE.AxesHelper(INITIAL_FRUSTUM_H / 4)
      this.scene.add(this.axesHelper)
    } else {
      this.orthoCamera.position.set(target.x, target.y, 10)
      this.resize()
      if (this.axesHelper) { this.scene.remove(this.axesHelper); this.axesHelper = null }
    }

    this.controls = this.makeControls()
    this.controls.target.copy(target)
    this.controls.update()
  }

  setPresetView(view: 'top' | 'front' | 'side' | 'iso') {
    if (this._mode !== '3d') return
    const target = this.controls.target
    const rh = this.orthoCamera.top - this.orthoCamera.bottom
    const d = Math.max(rh, 10) * 1.5

    switch (view) {
      case 'front':
        this.perspCamera.position.set(target.x + d * 0.2, target.y + d * 0.3, target.z + d)
        this.perspCamera.up.set(0, 1, 0)
        break
      case 'top':
        this.perspCamera.position.set(target.x, target.y + d, target.z)
        this.perspCamera.up.set(0, 0, -1)
        break
      case 'side':
        this.perspCamera.position.set(target.x + d, target.y, target.z)
        this.perspCamera.up.set(0, 1, 0)
        break
      case 'iso': {
        const t = d / Math.sqrt(3)
        this.perspCamera.position.set(target.x + t, target.y + t, target.z + t)
        this.perspCamera.up.set(0, 1, 0)
        break
      }
    }
    this.perspCamera.lookAt(target)
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

  addFrameCallback(cb: () => void) {
    this.frameCallbacks.push(cb)
  }

  private loop() {
    this.animId = requestAnimationFrame(() => this.loop())
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    for (const cb of this.frameCallbacks) cb()
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
      this.perspCamera.position.set(cx + dist * 0.2, cy + dist * 0.3, dist)
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
    if (this.axesHelper) this.scene.remove(this.axesHelper)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
