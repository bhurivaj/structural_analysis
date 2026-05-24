import { test, expect } from '@playwright/test'

const SESSION = JSON.stringify({
  nodes: [
    { id: 'n1', x: 0, y: 0, support: 'pinned', label: 'N1' },
    { id: 'n2', x: 3, y: 0, support: 'fixed', label: 'N2' },
  ],
  members: [
    { id: 'm1', startNodeId: 'n1', endNodeId: 'n2', E: 200000, A: 6353, I: 47200000, isTruss: false, label: 'M1' },
  ],
  structureType: 'frame',
  loads: [
    { id: 'l1', type: 'point_load', nodeId: 'n1', fx: 0, fy: -10, label: 'PL1', loadCase: 'L' },
    { id: 'l2', type: 'point_load', nodeId: 'n2', fx: 0, fy: -5, label: 'PL2', loadCase: 'D' },
  ],
  savedAt: new Date().toISOString(),
})

async function loadSession(page: Parameters<typeof test>[1]) {
  await page.goto('/workspace')
  await page.evaluate((s) => localStorage.setItem('structcalc_session', s), SESSION)
  await page.reload()
  const btn = page.getByRole('button', { name: 'Continue' })
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) await btn.click()
}

test.describe('Envelope Analysis', () => {
  test('⊛ Envelope button is visible in workspace sidebar', async ({ page }) => {
    await loadSession(page)
    await expect(page.getByRole('button', { name: /Envelope/i })).toBeVisible()
  })

  test('clicking Envelope button runs envelope and shows result on Analysis page', async ({ page }) => {
    await loadSession(page)

    // First run normal analysis so Analysis page has results
    await page.getByRole('button', { name: '▶ Run' }).click()
    await page.waitForFunction(() => !document.querySelector('button[disabled]') || true, { timeout: 5000 })

    // Click Envelope
    await page.getByRole('button', { name: /Envelope/i }).click()
    await page.waitForTimeout(1000)

    // Navigate to Analysis
    await page.getByRole('link', { name: /Analysis/i }).click()

    // Should show envelope badge
    await expect(page.getByText(/Envelope:/i)).toBeVisible()
    await expect(page.getByText(/combinations analyzed/i)).toBeVisible()
  })

  test('Design Assessment shows Active/Envelope toggle after envelope is run', async ({ page }) => {
    await loadSession(page)

    // Run normal analysis first
    await page.getByRole('button', { name: '▶ Run' }).click()
    await page.waitForTimeout(500)

    // Run envelope
    await page.getByRole('button', { name: /Envelope/i }).click()
    await page.waitForTimeout(1500)

    // Navigate to Analysis
    await page.getByRole('link', { name: /Analysis/i }).click()

    // Toggle buttons should appear
    await expect(page.getByRole('button', { name: 'Active' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Envelope' })).toBeVisible()
  })

  test('switching to Envelope mode shows governing combo badges', async ({ page }) => {
    await loadSession(page)

    await page.getByRole('button', { name: '▶ Run' }).click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /Envelope/i }).click()
    await page.waitForTimeout(1500)

    await page.getByRole('link', { name: /Analysis/i }).click()
    await page.getByRole('button', { name: 'Envelope' }).click()

    // There should be at least one combo badge visible
    await expect(page.locator('.text-indigo-600').first()).toBeVisible()
  })
})

test.describe('Capacity Graph', () => {
  test('alternatives row shows Table/Graph tab buttons', async ({ page }) => {
    await loadSession(page)
    await page.getByRole('button', { name: '▶ Run' }).click()
    await page.waitForTimeout(1000)
    await page.getByRole('link', { name: /Analysis/i }).click()

    // Expand first member row with ▼ button — must exist after analysis
    const expandBtn = page.locator('button').filter({ hasText: '▼' }).first()
    await expect(expandBtn).toBeVisible({ timeout: 3000 })
    await expandBtn.click()
    await expect(page.getByRole('button', { name: 'Table' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Graph' })).toBeVisible()
  })

  test('clicking Graph tab shows SVG chart', async ({ page }) => {
    await loadSession(page)
    await page.getByRole('button', { name: '▶ Run' }).click()
    await page.waitForTimeout(1000)
    await page.getByRole('link', { name: /Analysis/i }).click()

    const expandBtn = page.locator('button').filter({ hasText: '▼' }).first()
    await expect(expandBtn).toBeVisible({ timeout: 3000 })
    await expandBtn.click()
    await page.getByRole('button', { name: 'Graph' }).click()
    // SVG chart must appear
    await expect(page.locator('svg').last()).toBeVisible()
  })
})
