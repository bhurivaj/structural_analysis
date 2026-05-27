import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const INITIAL_FRUSTUM_H = 20

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  private orthoCamera: THREE.OrthographicCamera
  controls: OrbitControls
  private container: HTMLElement
  private animId = 0
  private ro: ResizeObserver
  private frameCallbacks: Array<() => void> = []

  get camera(): THREE.Camera {
    return this.orthoCamera
  }

  /** For backward-compat with threeHitTest.ts worldPixelSize() */
  get mode(): string { return '2d' }

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
    // Default: top view (looking down Y axis, up = -Z)
    this.orthoCamera.position.set(0, 10, 0)
    this.orthoCamera.up.set(0, 0, -1)
    this.orthoCamera.lookAt(0, 0, 0)

    this.scene = new THREE.Scene()
    this.controls = this.makeControls()

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.resize()
    this.loop()
  }

  private makeControls(): OrbitControls {
    const c = new OrbitControls(this.orthoCamera, this.renderer.domElement)
    c.enableDamping = false
    c.screenSpacePanning = true
    c.zoomToCursor = true
    // Left-click is owned by the interaction layer; right-click = rotate
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.ROTATE }
    this.renderer.domElement.addEventListener('contextmenu', e => e.preventDefault())
    return c
  }

  setPresetView(view: 'top' | 'front' | 'side' | 'iso') {
    const target = this.controls.target
    const h = this.orthoCamera.top - this.orthoCamera.bottom
    const d = Math.max(h / this.orthoCamera.zoom, 10) * 1.5

    switch (view) {
      case 'front':
        this.orthoCamera.position.set(target.x, target.y, target.z + d)
        this.orthoCamera.up.set(0, 1, 0)
        break
      case 'top':
        this.orthoCamera.position.set(target.x, target.y + d, target.z)
        this.orthoCamera.up.set(0, 0, -1)
        break
      case 'side':
        this.orthoCamera.position.set(target.x + d, target.y, target.z)
        this.orthoCamera.up.set(0, 1, 0)
        break
      case 'iso': {
        const t = d / Math.sqrt(3)
        this.orthoCamera.position.set(target.x + t, target.y + t, target.z + t)
        this.orthoCamera.up.set(0, 1, 0)
        break
      }
    }
    this.orthoCamera.lookAt(target)
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
    const fh = Math.max(rh * pad, (rw * pad) / a)
    const fw = fh * a
    this.orthoCamera.left = -fw / 2; this.orthoCamera.right = fw / 2
    this.orthoCamera.top = fh / 2; this.orthoCamera.bottom = -fh / 2
    this.orthoCamera.zoom = 1
    this.orthoCamera.updateProjectionMatrix()
    this.controls.target.set(cx, cy, 0)
    this.orthoCamera.position.set(cx, cy, 10)
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
