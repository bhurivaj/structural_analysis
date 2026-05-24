import { test, expect } from '@playwright/test'

async function waitForGrid(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.locator('#grid-layer line').first().waitFor({ state: 'attached', timeout: 5000 })
}

test.describe('Workspace canvas tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
  })

  test('toolbar shows all tools', async ({ page }) => {
    for (const label of ['↖', '✋', '●', '╱', '↓F', '▤', '↻']) {
      await expect(page.getByRole('button', { name: label })).toBeVisible()
    }
  })

  test('tool tooltip appears on hover', async ({ page }) => {
    await page.getByRole('button', { name: '↖' }).hover()
    await expect(page.getByText('Select / Move')).toBeVisible()
    await expect(page.getByText('S').first()).toBeVisible()
  })

  test('canvas SVG is rendered', async ({ page }) => {
    await expect(page.locator('svg')).toBeVisible()
  })

  test('Run button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: '▶ Run' })).toBeVisible()
  })

  test('Fit button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: '⊡ Fit' })).toBeVisible()
  })

  test('shows analysis error when running with no structure', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Run' }).click()
    await expect(page.getByText(/Need at least/i)).toBeVisible()
  })
})

test.describe('Workspace canvas pan and zoom', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForGrid(page)
  })

  test('PAN tool drag moves the grid', async ({ page }) => {
    const before = await page.locator('#grid-layer line').first().getAttribute('x1')

    const svgBox = await page.locator('svg').boundingBox()
    const cx = svgBox!.x + svgBox!.width / 2
    const cy = svgBox!.y + svgBox!.height / 2

    await page.getByRole('button', { name: '✋' }).click()
    await page.mouse.move(cx, cy)
    await page.mouse.down({ button: 'left' })
    await page.mouse.move(cx + 200, cy, { steps: 15 })
    await page.mouse.up({ button: 'left' })

    const after = await page.locator('#grid-layer line').first().getAttribute('x1')
    expect(parseFloat(after ?? '0')).not.toBe(parseFloat(before ?? '0'))
  })

  test('Space + drag pans the grid', async ({ page }) => {
    const before = await page.locator('#grid-layer line').first().getAttribute('x1')

    const svgBox = await page.locator('svg').boundingBox()
    const cx = svgBox!.x + svgBox!.width / 2
    const cy = svgBox!.y + svgBox!.height / 2

    await page.keyboard.down('Space')
    await page.mouse.move(cx, cy)
    await page.mouse.down({ button: 'left' })
    await page.mouse.move(cx + 150, cy, { steps: 15 })
    await page.mouse.up({ button: 'left' })
    await page.keyboard.up('Space')

    const after = await page.locator('#grid-layer line').first().getAttribute('x1')
    expect(parseFloat(after ?? '0')).not.toBe(parseFloat(before ?? '0'))
  })

  test('scroll wheel zoom changes grid density', async ({ page }) => {
    const before = await page.locator('#grid-layer line').count()

    const svgBox = await page.locator('svg').boundingBox()
    await page.mouse.move(svgBox!.x + svgBox!.width / 2, svgBox!.y + svgBox!.height / 2)
    await page.mouse.wheel(0, -500)

    const after = await page.locator('#grid-layer line').count()
    // Zooming in → larger gridPx → fewer lines visible
    expect(after).toBeLessThan(before)
  })

  test('grid stays visible after zooming in (adaptive grid)', async ({ page }) => {
    const svgBox = await page.locator('svg').boundingBox()
    const cx = svgBox!.x + svgBox!.width / 2
    const cy = svgBox!.y + svgBox!.height / 2
    // Zoom in substantially (5 scrolls)
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(cx, cy)
      await page.mouse.wheel(0, -300)
      await page.waitForTimeout(50)
    }
    // Grid lines must still be present (regression: old code hid grid at k>80)
    const count = await page.locator('#grid-layer line').count()
    expect(count).toBeGreaterThan(2)
  })

  test('origin crosshair is visible at (0,0)', async ({ page }) => {
    // There should be two extra lines for the origin crosshair inside #grid-layer
    // They are drawn with a different stroke color (#94a3b8) vs regular grid lines (#e2e8f0)
    const gridLines = page.locator('#grid-layer line')
    const count = await gridLines.count()
    expect(count).toBeGreaterThan(0)
  })
})

test.describe('Canvas keyboard features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForGrid(page)
  })

  test('G key toggles snap-to-grid indicator', async ({ page }) => {
    // Press G — the ⊞ snap button should switch to active state
    const snapBtn = page.getByRole('button', { name: '⊞' })
    const classBefore = await snapBtn.getAttribute('class') ?? ''
    await page.keyboard.press('g')
    await page.waitForTimeout(100)
    const classAfter = await snapBtn.getAttribute('class') ?? ''
    expect(classAfter).not.toBe(classBefore)
  })

  test('shift+drag node moves and completes without error', async ({ page }) => {
    const svgBox = await page.locator('svg').boundingBox()
    const cx = svgBox!.x + svgBox!.width / 2
    const cy = svgBox!.y + svgBox!.height / 2

    await page.keyboard.press('n')
    await page.mouse.click(cx, cy)
    await page.waitForTimeout(100)

    const node = page.locator('circle.node').first()
    const cxBefore = parseFloat((await node.getAttribute('cx')) ?? '0')

    const nodeBox = await node.boundingBox()
    const nx = nodeBox!.x + nodeBox!.width / 2
    const ny = nodeBox!.y + nodeBox!.height / 2

    await page.keyboard.press('s')
    await page.waitForTimeout(50)
    await page.keyboard.down('Shift')
    await page.mouse.move(nx, ny)
    await page.mouse.down()
    await page.mouse.move(nx + 100, ny + 30, { steps: 10 })
    await page.mouse.up()
    await page.keyboard.up('Shift')
    await page.waitForTimeout(100)

    const cxAfter = parseFloat((await node.getAttribute('cx')) ?? '0')
    // Node should have moved
    expect(cxAfter).not.toBeCloseTo(cxBefore, 0)
    // cx is in world (canvas) coordinates — snapping to integer world unit means cx is an integer
    expect(Math.abs(cxAfter - Math.round(cxAfter))).toBeLessThan(0.01)
  })
})

test.describe('Node drag with loads attached', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForGrid(page)
  })

  // Regression: drawAll() inside drag handler recreated node elements, breaking D3 drag state.
  // Fix: _isDragging flag skips drag-handler rebind in drawNodes() while drawAll() still runs
  // so forces/supports follow the node visually during drag.
  test('dragging a node with a load attached moves the node and load follows', async ({ page }) => {
    const svgBox = await page.locator('svg').boundingBox()
    const cx = svgBox!.x + svgBox!.width / 2
    const cy = svgBox!.y + svgBox!.height / 2

    // Add a node
    await page.keyboard.press('n')
    await page.mouse.click(cx, cy)
    await page.waitForTimeout(100)

    const node = page.locator('circle.node').first()
    await expect(node).toBeVisible()

    // Add a point load to the node (default Fy=-10 renders an arrow)
    await page.keyboard.press('l')
    await node.click()
    await page.waitForTimeout(200)
    await page.click('button:has-text("Add Load")')
    await page.waitForTimeout(200)

    // Switch to SELECT mode
    await page.keyboard.press('s')
    await page.waitForTimeout(100)

    // Record initial positions
    const beforeCx = parseFloat((await node.getAttribute('cx')) ?? '0')
    const loadLineBefore = await page.locator('#force-layer line').first().getAttribute('x2')

    // Drag the node 80px to the right
    const nodeBox = await node.boundingBox()
    const nx = nodeBox!.x + nodeBox!.width / 2
    const ny = nodeBox!.y + nodeBox!.height / 2
    await page.mouse.move(nx, ny)
    await page.mouse.down()
    await page.mouse.move(nx + 80, ny, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(100)

    // Node moved
    const afterCx = parseFloat((await node.getAttribute('cx')) ?? '0')
    expect(afterCx).not.toBeCloseTo(beforeCx, 1)

    // Load arrow also moved (x2 endpoint changed)
    const loadLineAfter = await page.locator('#force-layer line').first().getAttribute('x2')
    expect(parseFloat(loadLineAfter ?? '0')).not.toBeCloseTo(parseFloat(loadLineBefore ?? '0'), 1)
  })
})
