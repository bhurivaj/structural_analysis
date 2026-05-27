import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasMode } from '@/composables/useCanvasMode'

beforeEach(() => {
  const { setWorkplaneZ } = useCanvasMode()
  setWorkplaneZ(0)
})

describe('useCanvasMode', () => {
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
  })
})
