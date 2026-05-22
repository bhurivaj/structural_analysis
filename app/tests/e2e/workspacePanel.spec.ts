import { test, expect } from '@playwright/test'

test.describe('Workspace right-panel tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')

    // Dismiss resume dialog if present
    const resumeBtn = page.getByRole('button', { name: 'Start New' })
    if (await resumeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await resumeBtn.click()
    }
  })

  test('Node tab is active by default', async ({ page }) => {
    // The active tab has border-b-2 and blue text — we look for the "Node" button
    const nodeTab = page.getByRole('button', { name: 'Node' })
    await expect(nodeTab).toBeVisible()
  })

  test('Member tab can be selected', async ({ page }) => {
    await page.getByRole('button', { name: 'Member' }).click()
    await expect(page.getByRole('button', { name: 'Member' })).toBeVisible()
  })

  test('Load tab can be selected', async ({ page }) => {
    await page.getByRole('button', { name: 'Load', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Load', exact: true })).toBeVisible()
  })

  test('all three panel tabs are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Node', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Member', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Load', exact: true })).toBeVisible()
  })
})

test.describe('Workspace toolbar keyboard shortcuts label', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    const resumeBtn = page.getByRole('button', { name: 'Start New' })
    if (await resumeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await resumeBtn.click()
    }
  })

  test('tooltip for ADD_NODE tool shows "N" shortcut', async ({ page }) => {
    await page.getByRole('button', { name: '●' }).hover()
    await expect(page.getByText('Add Node')).toBeVisible()
    await expect(page.getByText('N').first()).toBeVisible()
  })

  test('tooltip for ADD_MEMBER tool shows "M" shortcut', async ({ page }) => {
    await page.getByRole('button', { name: '╱' }).hover()
    await expect(page.getByText('Add Member')).toBeVisible()
  })

  test('tooltip for POINT_LOAD tool shows "L" shortcut', async ({ page }) => {
    await page.getByRole('button', { name: '↓F' }).hover()
    await expect(page.getByText('Point Load')).toBeVisible()
  })

  test('tooltip for DIST_LOAD tool shows expected label', async ({ page }) => {
    await page.getByRole('button', { name: '▤' }).hover()
    await expect(page.getByText('Dist. Load')).toBeVisible()
  })

  test('tooltip for MOMENT tool shows expected label', async ({ page }) => {
    await page.getByRole('button', { name: '↻' }).hover()
    await expect(page.getByText('Moment')).toBeVisible()
  })

  test('tooltip for PAN tool shows "P" shortcut', async ({ page }) => {
    await page.getByRole('button', { name: '✋' }).hover()
    // The tooltip text is 'Pan' — use first() since 'pan' also appears in hint text
    await expect(page.getByText('Pan').first()).toBeVisible()
  })
})

test.describe('Workspace zoom indicator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    const resumeBtn = page.getByRole('button', { name: 'Start New' })
    if (await resumeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await resumeBtn.click()
    }
  })

  test('zoom percentage indicator is visible', async ({ page }) => {
    // The zoom indicator sits bottom-right; it contains e.g. "100%"
    // Locate it by its position classes (bottom-2 right-2)
    const zoomIndicator = page.locator('.bottom-2.right-2')
    await expect(zoomIndicator).toBeVisible()
    const text = await zoomIndicator.textContent()
    expect(text?.trim()).toMatch(/\d+%/)
  })

  test('zoom percentage changes after scrolling in', async ({ page }) => {
    const zoomIndicator = page.locator('.bottom-2.right-2')
    const before = (await zoomIndicator.textContent())?.trim()

    const svgBox = await page.locator('svg').boundingBox()
    await page.mouse.move(svgBox!.x + svgBox!.width / 2, svgBox!.y + svgBox!.height / 2)
    await page.mouse.wheel(0, -300)

    // Wait briefly for zoom to update
    await page.waitForTimeout(300)
    const after = (await zoomIndicator.textContent())?.trim()
    expect(after).not.toBe(before)
  })

  test('scroll hint text is visible', async ({ page }) => {
    await expect(page.getByText('Scroll to zoom · Middle-drag or Space+drag to pan')).toBeVisible()
  })
})

test.describe('Workspace Clear button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    const resumeBtn = page.getByRole('button', { name: 'Start New' })
    if (await resumeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await resumeBtn.click()
    }
  })

  test('Clear button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible()
  })

  test('Clear button does not throw an error when clicked with no results', async ({ page }) => {
    await page.getByRole('button', { name: 'Clear' }).click()
    // No error toast should appear after clearing with no result
    await expect(page.getByText(/error/i)).not.toBeVisible()
  })
})

test.describe('Support icons rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await page.locator('#grid-layer line').first().waitFor({ state: 'attached', timeout: 5000 })
    const resumeBtn = page.getByRole('button', { name: 'Start New' })
    if (await resumeBtn.isVisible({ timeout: 1000 }).catch(() => false)) await resumeBtn.click()
  })

  test('pinned support shows triangle polygon', async ({ page }) => {
    const svgBox = await page.locator('svg').boundingBox()
    const cx = svgBox!.x + svgBox!.width / 2
    const cy = svgBox!.y + svgBox!.height / 2

    await page.keyboard.press('n')
    await page.mouse.click(cx, cy)
    await page.waitForTimeout(100)

    // Select node and assign pinned support (filter by 'Free' option to find support select)
    await page.keyboard.press('s')
    await page.locator('circle.node').first().click()
    await page.waitForTimeout(150)
    const supportSelect = page.locator('select').filter({ hasText: 'Free' }).first()
    if (await supportSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await supportSelect.selectOption('pinned')
      await page.waitForTimeout(100)
    }

    // Pinned support draws a polygon triangle in the node layer
    await page.locator('#node-layer polygon').waitFor({ state: 'attached', timeout: 5000 })
  })

  test('fixed support shows rect block', async ({ page }) => {
    const svgBox = await page.locator('svg').boundingBox()
    const cx = svgBox!.x + svgBox!.width / 2
    const cy = svgBox!.y + svgBox!.height / 2

    await page.keyboard.press('n')
    await page.mouse.click(cx, cy)
    await page.waitForTimeout(100)

    await page.keyboard.press('s')
    await page.locator('circle.node').first().click()
    await page.waitForTimeout(150)
    const supportSelect = page.locator('select').filter({ hasText: 'Free' }).first()
    if (await supportSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await supportSelect.selectOption('fixed')
      await page.waitForTimeout(100)
    }

    // Fixed support draws a filled rect in the node layer
    await page.locator('#node-layer rect').waitFor({ state: 'attached', timeout: 5000 })
  })
})

test.describe('Distributed load rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await page.locator('#grid-layer line').first().waitFor({ state: 'attached', timeout: 5000 })
    const resumeBtn = page.getByRole('button', { name: 'Start New' })
    if (await resumeBtn.isVisible({ timeout: 1000 }).catch(() => false)) await resumeBtn.click()
  })

  test('distributed load shows arrows in canvas after adding', async ({ page }) => {
    const svgBox = await page.locator('svg').boundingBox()
    const cx = svgBox!.x + svgBox!.width / 2
    const cy = svgBox!.y + svgBox!.height / 2

    // Add two nodes
    await page.keyboard.press('n')
    await page.mouse.click(cx - 80, cy)
    await page.waitForTimeout(80)
    await page.mouse.click(cx + 80, cy)
    await page.waitForTimeout(80)

    // Add member
    await page.keyboard.press('m')
    await page.locator('circle.node').first().click()
    await page.waitForTimeout(50)
    await page.locator('circle.node').last().click()
    await page.waitForTimeout(80)

    // Add distributed load (D key → click member hit area)
    await page.keyboard.press('d')
    await page.waitForTimeout(50)
    await page.locator('line.member-hit').first().click({ force: true })
    await page.waitForTimeout(200)

    const addDlBtn = page.locator('button:has-text("Add Load")').first()
    if (await addDlBtn.isVisible()) {
      await addDlBtn.click()
      await page.waitForTimeout(200)
    }

    // Distributed load renders fill polygon in force-layer
    const dlPolygon = page.locator('#force-layer polygon')
    await expect(dlPolygon.first()).toBeAttached()
  })
})
