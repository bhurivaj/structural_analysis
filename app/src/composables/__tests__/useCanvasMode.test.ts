import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasMode } from '@/composables/useCanvasMode'

// Reset module-level refs between tests
beforeEach(() => {
  const { setCameraMode, setWorkplaneZ } = useCanvasMode()
  setCameraMode('2d')
  setWorkplaneZ(0)
})

describe('useCanvasMode', () => {
  describe('cameraMode', () => {
    it('defaults to 2d', () => {
      const { cameraMode } = useCanvasMode()
      expect(cameraMode.value).toBe('2d')
    })

    it('setCameraMode switches to 3d', () => {
      const { cameraMode, setCameraMode } = useCanvasMode()
      setCameraMode('3d')
      expect(cameraMode.value).toBe('3d')
    })

    it('setCameraMode switches back to 2d', () => {
      const { cameraMode, setCameraMode } = useCanvasMode()
      setCameraMode('3d')
      setCameraMode('2d')
      expect(cameraMode.value).toBe('2d')
    })
  })

  describe('workplaneZ', () => {
    it('defaults to 0', () => {
      const { workplaneZ } = useCanvasMode()
      expect(workplaneZ.value).toBe(0)
    })

    it('setWorkplaneZ updates workplaneZ value', () => {
      const { workplaneZ, setWorkplaneZ } = useCanvasMode()
      setWorkplaneZ(5)
      expect(workplaneZ.value).toBe(5)
    })

    it('workplaneZ is shared across composable calls', () => {
      const a = useCanvasMode()
      a.setWorkplaneZ(3.5)
      const b = useCanvasMode()
      expect(b.workplaneZ.value).toBe(3.5)
    })

    it('accepts negative z values', () => {
      const { workplaneZ, setWorkplaneZ } = useCanvasMode()
      setWorkplaneZ(-2)
      expect(workplaneZ.value).toBe(-2)
    })

    it('setWorkplaneZ does not affect cameraMode', () => {
      const { cameraMode, setCameraMode, setWorkplaneZ } = useCanvasMode()
      setCameraMode('3d')
      setWorkplaneZ(10)
      expect(cameraMode.value).toBe('3d')
    })
  })
})
