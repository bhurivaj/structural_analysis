import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasTool } from '@/composables/useCanvasTool'
import type { CanvasTool } from '@/composables/useCanvasTool'

/**
 * useCanvasTool uses a module-level singleton ref for activeTool.
 * We reset it to SELECT before each test to ensure isolation.
 */
describe('useCanvasTool', () => {
  beforeEach(() => {
    const { setTool } = useCanvasTool()
    setTool('SELECT')
  })

  describe('initial state', () => {
    it('activeTool starts at SELECT after reset', () => {
      const { activeTool } = useCanvasTool()
      expect(activeTool.value).toBe('SELECT')
    })
  })

  describe('setTool', () => {
    const allTools: CanvasTool[] = [
      'SELECT', 'ADD_NODE', 'ADD_MEMBER',
      'ADD_POINT_LOAD', 'ADD_DIST_LOAD', 'ADD_MOMENT', 'PAN',
    ]

    allTools.forEach(tool => {
      it(`sets tool to ${tool}`, () => {
        const { setTool, activeTool } = useCanvasTool()
        setTool(tool)
        expect(activeTool.value).toBe(tool)
      })
    })

    it('updates the shared activeTool across different useCanvasTool calls', () => {
      const instance1 = useCanvasTool()
      const instance2 = useCanvasTool()

      instance1.setTool('PAN')
      expect(instance2.activeTool.value).toBe('PAN')
    })

    it('can switch between tools multiple times', () => {
      const { setTool, activeTool } = useCanvasTool()
      setTool('ADD_NODE')
      expect(activeTool.value).toBe('ADD_NODE')
      setTool('ADD_MEMBER')
      expect(activeTool.value).toBe('ADD_MEMBER')
      setTool('SELECT')
      expect(activeTool.value).toBe('SELECT')
    })
  })
})
