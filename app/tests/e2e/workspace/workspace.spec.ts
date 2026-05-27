import { test, expect, type Page } from '@playwright/test'

async function waitForCanvas(page: Page) {
  await page.locator('#structure-canvas canvas').waitFor({ state: 'attached', timeout: 8000 })
}

async function clickCanvas(page: Page, x: number, y: number) {
  await page.click('#structure-canvas', { position: { x, y } })
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

  test('canvas WebGL element is rendered', async ({ page }) => {
    await waitForCanvas(page)
    await expect(page.locator('#structure-canvas canvas')).toBeVisible()
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
    await waitForCanvas(page)
  })

  test('PAN tool drag keeps canvas responsive', async ({ page }) => {
    const box = await page.locator('#structure-canvas').boundingBox()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2

    await page.getByRole('button', { name: '✋' }).click()
    await page.mouse.move(cx, cy)
    await page.mouse.down({ button: 'left' })
    await page.mouse.move(cx + 200, cy, { steps: 15 })
    await page.mouse.up({ button: 'left' })

    // Canvas stays rendered
    await expect(page.locator('#structure-canvas canvas')).toBeVisible()
  })

  test('Space + drag keeps canvas responsive', async ({ page }) => {
    const box = await page.locator('#structure-canvas').boundingBox()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2

    await page.keyboard.down('Space')
    await page.mouse.move(cx, cy)
    await page.mouse.down({ button: 'left' })
    await page.mouse.move(cx + 150, cy, { steps: 15 })
    await page.mouse.up({ button: 'left' })
    await page.keyboard.up('Space')

    await expect(page.locator('#structure-canvas canvas')).toBeVisible()
  })

  test('scroll wheel zoom changes zoom indicator', async ({ page }) => {
    const zoomIndicator = page.locator('.bottom-2.right-2')
    const before = (await zoomIndicator.textContent())?.trim()

    const box = await page.locator('#structure-canvas').boundingBox()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.wheel(0, -500)
    await page.waitForTimeout(300)

    const after = (await zoomIndicator.textContent())?.trim()
    expect(after).not.toBe(before)
  })

  test('canvas stays visible after multiple zooms (adaptive grid)', async ({ page }) => {
    const box = await page.locator('#structure-canvas').boundingBox()
    const cx = box!.x + box!.width / 2
    const cy = box!.y + box!.height / 2
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(cx, cy)
      await page.mouse.wheel(0, -300)
      await page.waitForTimeout(50)
    }
    await expect(page.locator('#structure-canvas canvas')).toBeVisible()
    const zoomText = (await page.locator('.bottom-2.right-2').textContent())?.trim()
    expect(parseInt(zoomText ?? '0')).toBeGreaterThan(100)
  })

  test('origin marker area is accessible (canvas rendered)', async ({ page }) => {
    await expect(page.locator('#structure-canvas canvas')).toBeVisible()
    // Origin crosshair is WebGL-rendered — verify canvas exists
    const box = await page.locator('#structure-canvas').boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(0)
  })
})

test.describe('Canvas keyboard features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForCanvas(page)
  })

  test('G key toggles snap-to-grid indicator', async ({ page }) => {
    const snapBtn = page.getByRole('button', { name: '⊞' })
    const classBefore = await snapBtn.getAttribute('class') ?? ''
    await page.keyboard.press('g')
    await page.waitForTimeout(100)
    const classAfter = await snapBtn.getAttribute('class') ?? ''
    expect(classAfter).not.toBe(classBefore)
  })

  test('shift+drag node moves it (label position changes)', async ({ page }) => {
    // Place node at center
    const cx = 400
    const cy = 300
    await page.keyboard.press('n')
    await clickCanvas(page, cx, cy)
    await page.waitForTimeout(150)

    // Verify label N1 appeared
    const label = page.locator('span.font-mono').filter({ hasText: /^N1$/ })
    await expect(label).toBeVisible({ timeout: 2000 })

    const boxBefore = await label.boundingBox()

    // Shift+drag from node position
    const box = await page.locator('#structure-canvas').boundingBox()
    await page.keyboard.press('s')
    await page.waitForTimeout(50)
    await page.keyboard.down('Shift')
    await page.mouse.move(box!.x + cx, box!.y + cy)
    await page.mouse.down()
    await page.mouse.move(box!.x + cx + 100, box!.y + cy + 30, { steps: 10 })
    await page.mouse.up()
    await page.keyboard.up('Shift')
    await page.waitForTimeout(150)

    const boxAfter = await label.boundingBox()
    // Node label should have moved
    expect(boxAfter!.x).not.toBeCloseTo(boxBefore!.x, 0)
  })
})

test.describe('Node drag with loads attached', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForCanvas(page)
  })

  test('dragging a node with a load attached moves the node without orphaning the load', async ({ page }) => {
    const cx = 400
    const cy = 300

    // Add a node
    await page.keyboard.press('n')
    await clickCanvas(page, cx, cy)
    await page.waitForTimeout(100)

    // Verify label N1
    await expect(page.locator('span.font-mono').filter({ hasText: /^N1$/ })).toBeVisible({ timeout: 2000 })

    // Add a point load: press L, click node position
    await page.keyboard.press('l')
    await clickCanvas(page, cx, cy)
    await page.waitForTimeout(300)
    const addBtn = page.locator('button:has-text("Add Load")').first()
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click()
      await page.waitForTimeout(300)
    }

    // Verify load appears in load list (panel)
    const loadList = page.locator('text=PL1')
    await expect(loadList).toBeVisible({ timeout: 3000 })

    // Switch to SELECT mode and drag node
    await page.keyboard.press('s')
    await page.waitForTimeout(50)

    const box = await page.locator('#structure-canvas').boundingBox()
    await page.mouse.move(box!.x + cx, box!.y + cy)
    await page.mouse.down()
    await page.mouse.move(box!.x + cx + 80, box!.y + cy, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(100)

    // Tab may have switched to Node after drag — switch back to Load tab to verify load not orphaned
    await page.getByRole('button', { name: 'Load', exact: true }).click()
    await page.waitForTimeout(200)

    // Load should still be in the list (not orphaned)
    await expect(page.locator('text=PL1')).toBeVisible()
  })
})
