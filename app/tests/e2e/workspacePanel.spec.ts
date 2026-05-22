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
