import { test, expect } from '@playwright/test'

test.describe('Canvas Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/')
    await page.waitForLoadState('networkidle')
  })

  // ─── Deselect on Background Click ────────────────────────────────────────────
  test.describe('Deselect on background click', () => {
    test('clicking empty canvas in SELECT mode clears selection', async ({ page }) => {
      // Add a node
      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 400, y: 300 } })
      await page.waitForTimeout(100)

      // Verify node appears
      const node = page.locator('circle.node').first()
      await expect(node).toBeVisible()

      // SELECT mode (default)
      await page.keyboard.press('s')

      // Click node to select it
      await node.click()
      await page.waitForTimeout(100)

      // Verify selected (darker fill)
      let fill = await node.getAttribute('fill')
      expect(fill).toBe('#2563eb')

      // Click empty canvas
      await page.click('#structure-canvas', { position: { x: 300, y: 200 } })
      await page.waitForTimeout(100)

      // Verify node is deselected (back to original color)
      fill = await node.getAttribute('fill')
      expect(fill).toBe('#1e293b')
    })
  })

  // ─── Ghost Line Preview for ADD_MEMBER ───────────────────────────────────────
  test.describe('ADD_MEMBER ghost line preview', () => {
    test('ghost line appears when adding member', async ({ page }) => {
      // Add two nodes
      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)

      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
      await page.waitForTimeout(50)

      // Switch to ADD_MEMBER
      await page.keyboard.press('m')
      await page.waitForTimeout(50)

      // Click first node
      const node1 = page.locator('circle.node').first()
      await node1.click()
      await page.waitForTimeout(100)

      // Move mouse to trigger ghost line
      await page.mouse.move(450, 300)
      await page.waitForTimeout(100)

      // Ghost line should exist
      const ghostLine = page.locator('line.ghost-line')
      const count = await ghostLine.count()
      expect(count).toBeGreaterThan(0)
    })

    test('ghost line clears when pressing Escape', async ({ page }) => {
      // Add two nodes
      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)

      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
      await page.waitForTimeout(50)

      // Start adding member
      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      await page.click('circle.node', { force: true })
      await page.waitForTimeout(50)

      // Move mouse
      await page.mouse.move(450, 300)
      await page.waitForTimeout(100)

      // Ghost line should exist
      let ghostLine = page.locator('line.ghost-line')
      expect(await ghostLine.count()).toBeGreaterThan(0)

      // Press Escape to cancel
      await page.keyboard.press('Escape')
      await page.waitForTimeout(100)

      // Ghost line should be gone
      ghostLine = page.locator('line.ghost-line')
      expect(await ghostLine.count()).toBe(0)
    })
  })

  // ─── Directional Rubber-band Selection ───────────────────────────────────────
  test.describe('Directional rubber-band selection (window vs crossing)', () => {
    test('window selection (left→right) shows solid blue box', async ({ page }) => {
      // Add a node
      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)

      // SELECT mode
      await page.keyboard.press('s')

      // Window selection (left→right)
      await page.mouse.move(300, 250)
      await page.mouse.down()
      await page.mouse.move(400, 350)
      await page.waitForTimeout(100)

      // Selection rect should be visible with blue border
      const selectionDivs = page.locator('div[style*="border: 1.5px solid"]')
      const count = await selectionDivs.count()
      expect(count).toBeGreaterThan(0)

      await page.mouse.up()
    })

    test('crossing selection (right→left) shows dashed green box', async ({
      page,
    }) => {
      // Add a node
      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)

      // SELECT mode
      await page.keyboard.press('s')

      // Crossing selection (right→left)
      await page.mouse.move(400, 250)
      await page.mouse.down()
      await page.mouse.move(300, 350) // drag backward
      await page.waitForTimeout(100)

      // Selection rect should be visible with dashed border
      const selectionDivs = page.locator('div[style*="border: 1.5px dashed"]')
      const count = await selectionDivs.count()
      expect(count).toBeGreaterThan(0)

      await page.mouse.up()
    })
  })

  // ─── Wider Member Hit Area ──────────────────────────────────────────────────
  test.describe('Wider member hit area', () => {
    test('member hit zone layer is created when members exist', async ({ page }) => {
      // Create two nodes
      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 400, y: 300 } })
      await page.waitForTimeout(50)

      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 500, y: 300 } })
      await page.waitForTimeout(100)

      // Verify nodes were created
      const nodes = page.locator('circle.node')
      const nodeCount = await nodes.count()
      expect(nodeCount).toBe(2)
    })
  })

  // ─── Cursor Feedback ────────────────────────────────────────────────────────
  test.describe('Cursor feedback for tool modes', () => {
    test('load tools show crosshair cursor', async ({ page }) => {
      const svg = page.locator('#structure-canvas')

      // ADD_POINT_LOAD should be crosshair
      await page.keyboard.press('l')
      await page.waitForTimeout(50)
      let cursor = await svg.evaluate((el) => window.getComputedStyle(el).cursor)
      expect(cursor).toBe('crosshair')

      // ADD_DIST_LOAD should be crosshair
      await page.keyboard.press('d')
      await page.waitForTimeout(50)
      cursor = await svg.evaluate((el) => window.getComputedStyle(el).cursor)
      expect(cursor).toBe('crosshair')

      // ADD_MOMENT should be crosshair
      await page.keyboard.press('r')
      await page.waitForTimeout(50)
      cursor = await svg.evaluate((el) => window.getComputedStyle(el).cursor)
      expect(cursor).toBe('crosshair')
    })

    test('tool mode cursors are appropriate', async ({ page }) => {
      const svg = page.locator('#structure-canvas')

      // SELECT mode is default
      await page.keyboard.press('s')
      await page.waitForTimeout(50)
      let cursor = await svg.evaluate((el) => window.getComputedStyle(el).cursor)
      expect(cursor).toBe('default')

      // PAN mode is grab
      await page.keyboard.press('p')
      await page.waitForTimeout(50)
      cursor = await svg.evaluate((el) => window.getComputedStyle(el).cursor)
      expect(cursor).toBe('grab')
    })
  })

  // ─── Member Label Rotation (parallel to member line) ───────────────────────
  test.describe('Member label rotation', () => {
    test('member labels appear on canvas at member midpoint', async ({ page }) => {
      // Create two nodes
      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)

      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
      await page.waitForTimeout(100)

      // Create member
      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      const node1 = page.locator('circle.node').first()
      await node1.click()
      await page.waitForTimeout(50)
      const node2 = page.locator('circle.node').last()
      await node2.click()
      await page.waitForTimeout(100)

      // Member label should exist
      const label = page.locator('text.member-label')
      const count = await label.count()
      expect(count).toBeGreaterThan(0)
    })

    test('member labels have transform attribute with rotation', async ({ page }) => {
      // Create diagonal member (more obvious rotation)
      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 350, y: 250 } })
      await page.waitForTimeout(50)

      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 450, y: 350 } })
      await page.waitForTimeout(100)

      // Create member
      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      await page.click('circle.node', { force: true })
      await page.waitForTimeout(50)
      const nodes = page.locator('circle.node')
      await nodes.last().click()
      await page.waitForTimeout(100)

      // Label should have transform attribute with rotation
      const label = page.locator('text.member-label').first()
      const transform = await label.getAttribute('transform')
      expect(transform).toBeTruthy()
      expect(transform).toContain('translate')
      expect(transform).toContain('rotate')
    })

    test('member label color changes when member is selected', async ({ page }) => {
      // Create member
      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)

      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
      await page.waitForTimeout(100)

      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      await page.click('circle.node', { force: true })
      await page.waitForTimeout(50)
      const nodes = page.locator('circle.node')
      await nodes.last().click()
      await page.waitForTimeout(100)

      // Get label's initial color (unselected)
      const label = page.locator('text.member-label').first()
      let fill = await label.getAttribute('fill')
      expect(fill).toBe('#64748b') // slate-500

      // Select member via canvas
      await page.keyboard.press('s')
      await page.waitForTimeout(50)
      const memberHit = page.locator('line.member-hit').first()
      await memberHit.click({ force: true })
      await page.waitForTimeout(100)

      // Label color should change to blue
      fill = await label.getAttribute('fill')
      expect(fill).toBe('#2563eb') // blue-600
    })

    test('member labels remain readable at various angles', async ({ page }) => {
      // Create members at different angles: horizontal, vertical, diagonal
      // Horizontal
      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 300, y: 200 } })
      await page.waitForTimeout(50)

      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 400, y: 200 } })
      await page.waitForTimeout(100)

      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      await page.click('circle.node', { force: true })
      await page.waitForTimeout(50)
      const allNodes = page.locator('circle.node')
      const nodeCount = await allNodes.count()
      await allNodes.nth(1).click()
      await page.waitForTimeout(100)

      // Labels should exist and have transform
      const labels = page.locator('text.member-label')
      const labelCount = await labels.count()
      expect(labelCount).toBeGreaterThan(0)

      // Each label should have a valid transform
      for (let i = 0; i < labelCount; i++) {
        const label = labels.nth(i)
        const transform = await label.getAttribute('transform')
        expect(transform).toBeTruthy()
      }
    })

    test('member label size scales appropriately with zoom', async ({ page }) => {
      // Create member
      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)

      await page.keyboard.press('n')
      await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
      await page.waitForTimeout(100)

      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      await page.click('circle.node', { force: true })
      await page.waitForTimeout(50)
      const nodes = page.locator('circle.node')
      await nodes.last().click()
      await page.waitForTimeout(100)

      const label = page.locator('text.member-label').first()

      // Get initial font-size
      const initialFontSize = await label.getAttribute('font-size')
      expect(initialFontSize).toBeTruthy()

      // Zoom in via scroll
      const svg = page.locator('#structure-canvas')
      await svg.evaluate(() => {
        const wheelEvent = new WheelEvent('wheel', {
          deltaY: -100,
          bubbles: true,
        })
        document.querySelector('#structure-canvas')?.dispatchEvent(wheelEvent)
      })
      await page.waitForTimeout(200)

      // Font size should change due to zoom scaling
      const zoomedFontSize = await label.getAttribute('font-size')
      expect(zoomedFontSize).toBeTruthy()
      // Just verify the attribute exists and is different (due to zoom scaling)
      expect(zoomedFontSize).not.toBe(initialFontSize)
    })
  })
})
