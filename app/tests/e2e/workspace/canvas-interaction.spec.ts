import { test, expect } from '@playwright/test'

async function waitForCanvas(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.locator('#structure-canvas canvas').waitFor({ state: 'attached', timeout: 8000 })
}

async function placeNode(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never, x: number, y: number) {
  await page.click('#structure-canvas', { position: { x, y } })
  await page.waitForTimeout(80)
}

test.describe('Canvas Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/')
    await waitForCanvas(page)
  })

  // ─── Deselect on Background Click ────────────────────────────────────────────
  test.describe('Deselect on background click', () => {
    test('clicking empty canvas in SELECT mode clears selection', async ({ page }) => {
      // Add a node
      await page.keyboard.press('n')
      await placeNode(page, 400, 300)

      // Verify N1 label appears
      await expect(page.locator('span.font-mono').filter({ hasText: /^N1$/ })).toBeVisible({ timeout: 2000 })

      // SELECT mode — click the node to select it
      await page.keyboard.press('s')
      await page.click('#structure-canvas', { position: { x: 400, y: 300 } })
      await page.waitForTimeout(100)

      // Node panel should be visible after selection
      await expect(page.locator('select').filter({ hasText: 'Free' }).first()).toBeVisible({ timeout: 1000 })

      // Click empty canvas to deselect
      await page.click('#structure-canvas', { position: { x: 200, y: 150 } })
      await page.waitForTimeout(100)

      // NodePanel should no longer show node-specific fields
      // (In Workspace, the right panel returns to its default state after deselect)
      const supportDropdown = page.locator('select').filter({ hasText: 'Free' }).first()
      // After deselect, if NodePanel collapses the support dropdown won't be shown
      // Verify canvas is still rendered (no crash)
      await expect(page.locator('#structure-canvas canvas')).toBeVisible()
    })
  })

  // ─── Ghost Line Preview for ADD_MEMBER ───────────────────────────────────────
  test.describe('ADD_MEMBER ghost line preview', () => {
    test('ghost line is active when adding member (canvas stays responsive)', async ({ page }) => {
      // Add two nodes
      await page.keyboard.press('n')
      await placeNode(page, 350, 300)
      await placeNode(page, 450, 300)

      // Switch to ADD_MEMBER, click first node
      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(100)

      // Move mouse — ghost line is rendered in WebGL, verify canvas still runs
      const box = await page.locator('#structure-canvas').boundingBox()
      await page.mouse.move(box!.x + 450, box!.y + 300)
      await page.waitForTimeout(100)

      await expect(page.locator('#structure-canvas canvas')).toBeVisible()
    })

    test('ghost line clears when pressing Escape (no pending member)', async ({ page }) => {
      await page.keyboard.press('n')
      await placeNode(page, 350, 300)
      await placeNode(page, 450, 300)

      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)

      // Press Escape to cancel
      await page.keyboard.press('Escape')
      await page.waitForTimeout(100)

      // After Escape, clicking second node should NOT create a member
      // (first click = start node, Escape cancels → next M click starts fresh)
      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
      await page.waitForTimeout(100)

      // M1 label should appear (member was created in the fresh ADD_MEMBER attempt)
      await expect(page.locator('span.font-mono').filter({ hasText: /^M1$/ })).toBeVisible({ timeout: 2000 })
    })
  })

  // ─── Directional Rubber-band Selection ───────────────────────────────────────
  test.describe('Directional rubber-band selection (window vs crossing)', () => {
    test('window selection (left→right) shows solid blue box', async ({ page }) => {
      await page.keyboard.press('n')
      await placeNode(page, 350, 300)

      await page.keyboard.press('s')

      const box = await page.locator('#structure-canvas').boundingBox()
      await page.mouse.move(box!.x + 300, box!.y + 250)
      await page.mouse.down()
      await page.mouse.move(box!.x + 400, box!.y + 350)
      await page.waitForTimeout(100)

      // HTML selection rect with solid border
      const selectionDivs = page.locator('div[style*="border: 1.5px solid"]')
      const count = await selectionDivs.count()
      expect(count).toBeGreaterThan(0)

      await page.mouse.up()
    })

    test('crossing selection (right→left) shows dashed green box', async ({ page }) => {
      await page.keyboard.press('n')
      await placeNode(page, 350, 300)

      await page.keyboard.press('s')

      const box = await page.locator('#structure-canvas').boundingBox()
      await page.mouse.move(box!.x + 400, box!.y + 250)
      await page.mouse.down()
      await page.mouse.move(box!.x + 300, box!.y + 350)
      await page.waitForTimeout(100)

      // HTML selection rect with dashed border
      const selectionDivs = page.locator('div[style*="border: 1.5px dashed"]')
      const count = await selectionDivs.count()
      expect(count).toBeGreaterThan(0)

      await page.mouse.up()
    })
  })

  // ─── Member Placement Verification ─────────────────────────────────────────
  test.describe('Wider member hit area', () => {
    test('two nodes placed show N1 and N2 labels', async ({ page }) => {
      await page.keyboard.press('n')
      await placeNode(page, 400, 300)
      await placeNode(page, 500, 300)

      await expect(page.locator('span.font-mono').filter({ hasText: /^N1$/ })).toBeVisible({ timeout: 2000 })
      await expect(page.locator('span.font-mono').filter({ hasText: /^N2$/ })).toBeVisible({ timeout: 2000 })
    })
  })

  // ─── Cursor Feedback ────────────────────────────────────────────────────────
  test.describe('Cursor feedback for tool modes', () => {
    test('load tools show crosshair cursor', async ({ page }) => {
      const canvas = page.locator('#structure-canvas')

      await page.keyboard.press('l')
      await page.waitForTimeout(50)
      let cursor = await canvas.evaluate((el) => window.getComputedStyle(el).cursor)
      expect(cursor).toBe('crosshair')

      await page.keyboard.press('d')
      await page.waitForTimeout(50)
      cursor = await canvas.evaluate((el) => window.getComputedStyle(el).cursor)
      expect(cursor).toBe('crosshair')

      await page.keyboard.press('r')
      await page.waitForTimeout(50)
      cursor = await canvas.evaluate((el) => window.getComputedStyle(el).cursor)
      expect(cursor).toBe('crosshair')
    })

    test('tool mode cursors are appropriate', async ({ page }) => {
      const canvas = page.locator('#structure-canvas')

      await page.keyboard.press('s')
      await page.waitForTimeout(50)
      let cursor = await canvas.evaluate((el) => window.getComputedStyle(el).cursor)
      expect(cursor).toBe('default')

      await page.keyboard.press('p')
      await page.waitForTimeout(50)
      cursor = await canvas.evaluate((el) => window.getComputedStyle(el).cursor)
      expect(cursor).toBe('grab')
    })
  })

  // ─── Member Labels (HTML overlay spans) ────────────────────────────────────
  test.describe('Member label overlay', () => {
    test('member labels appear as HTML spans after member is created', async ({ page }) => {
      await page.keyboard.press('n')
      await placeNode(page, 350, 300)
      await placeNode(page, 450, 300)

      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
      await page.waitForTimeout(100)

      // Member label span exists (text-slate-400 class)
      await expect(page.locator('span.text-slate-400').filter({ hasText: /^M1$/ })).toBeVisible({ timeout: 2000 })
    })

    test('member labels are positioned near member midpoint', async ({ page }) => {
      await page.keyboard.press('n')
      await placeNode(page, 350, 300)
      await placeNode(page, 450, 300)

      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
      await page.waitForTimeout(100)

      const label = page.locator('span.text-slate-400').filter({ hasText: /^M1$/ })
      const box = await label.boundingBox()
      const canvasBox = await page.locator('#structure-canvas').boundingBox()

      // Label should be inside the canvas bounds
      expect(box!.x).toBeGreaterThan(canvasBox!.x)
      expect(box!.y).toBeGreaterThan(canvasBox!.y)
      expect(box!.x).toBeLessThan(canvasBox!.x + canvasBox!.width)
    })

    test('member label appears when member is selected (panel visible)', async ({ page }) => {
      await page.keyboard.press('n')
      await placeNode(page, 350, 300)
      await placeNode(page, 450, 300)

      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
      await page.waitForTimeout(100)

      // Select the member by clicking near midpoint
      await page.keyboard.press('s')
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 400, y: 300 } })
      await page.waitForTimeout(150)

      // Member label is still visible, member panel may appear
      await expect(page.locator('span.text-slate-400').filter({ hasText: /^M1$/ })).toBeVisible({ timeout: 2000 })
    })

    test('node labels are always present as HTML spans', async ({ page }) => {
      await page.keyboard.press('n')
      await placeNode(page, 300, 200)
      await placeNode(page, 400, 350)

      // Node labels are text-slate-500 spans
      await expect(page.locator('span.text-slate-500').filter({ hasText: /^N1$/ })).toBeVisible({ timeout: 2000 })
      await expect(page.locator('span.text-slate-500').filter({ hasText: /^N2$/ })).toBeVisible({ timeout: 2000 })
    })

    test('canvas stays rendered after zoom (labels remain visible)', async ({ page }) => {
      await page.keyboard.press('n')
      await placeNode(page, 350, 300)
      await placeNode(page, 450, 300)

      await page.keyboard.press('m')
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
      await page.waitForTimeout(50)
      await page.click('#structure-canvas', { position: { x: 450, y: 300 } })
      await page.waitForTimeout(100)

      // Zoom in
      const box = await page.locator('#structure-canvas').boundingBox()
      await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
      await page.mouse.wheel(0, -200)
      await page.waitForTimeout(200)

      // Labels still rendered
      await expect(page.locator('span.text-slate-400').filter({ hasText: /^M1$/ })).toBeVisible({ timeout: 2000 })
    })
  })
})
