import { test, expect } from '@playwright/test'

// Minimal session with 2 nodes, 1 member, 1 pinned + 1 fixed support, 1 point load
const SESSION_WITH_LOAD = JSON.stringify({
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

async function setupSession(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.goto('/workspace')
  await page.evaluate((session) => {
    localStorage.setItem('structcalc_session', session)
  }, SESSION_WITH_LOAD)
  await page.reload()
  const resumeBtn = page.getByRole('button', { name: 'Continue' })
  if (await resumeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await resumeBtn.click()
  }
}

test.describe('Load Cases — Combo tab', () => {
  test('Combo tab is visible in right panel', async ({ page }) => {
    await page.goto('/workspace')
    await expect(page.getByRole('button', { name: 'Combo' })).toBeVisible()
  })

  test('Combo tab shows AISC default combinations', async ({ page }) => {
    await page.goto('/workspace')
    await page.getByRole('button', { name: 'Combo' }).click()
    await expect(page.getByText('1.2D + 1.6L')).toBeVisible()
    await expect(page.getByText('1.4D')).toBeVisible()
    await expect(page.getByText('0.9D + 1.0W')).toBeVisible()
  })

  test('Service combination is active by default', async ({ page }) => {
    await page.goto('/workspace')
    await page.getByRole('button', { name: 'Combo' }).click()
    await expect(page.locator('.font-medium').filter({ hasText: /Service/ }).first()).toBeVisible()
  })

  test('clicking a combination makes it active', async ({ page }) => {
    await page.goto('/workspace')
    await page.getByRole('button', { name: 'Combo' }).click()
    await page.getByText('1.2D + 1.6L').click()
    // The active combination name should appear near the Run Analysis button
    await expect(page.getByText('1.2D + 1.6L').first()).toBeVisible()
  })
})

test.describe('Load Cases — active combo badge near Run Analysis', () => {
  test('shows active combination name above Run button', async ({ page }) => {
    await page.goto('/workspace')
    // Service should be default
    await expect(page.getByText('Service (1.0D + 1.0L)').first()).toBeVisible()
  })

  test('badge updates when active combination changes', async ({ page }) => {
    await page.goto('/workspace')
    await page.getByRole('button', { name: 'Combo' }).click()
    await page.getByText('1.4D').click()
    await expect(page.getByText('1.4D').first()).toBeVisible()
  })
})

test.describe('Load Cases — load case badge in Load Panel', () => {
  test.beforeEach(async ({ page }) => {
    await setupSession(page)
  })

  test('load list shows case badge for loads with assigned case', async ({ page }) => {
    await page.getByRole('button', { name: 'Load' }).click()
    // PL1 has loadCase: 'L', should show L badge
    await expect(page.getByText('L').first()).toBeVisible()
    // PL2 has loadCase: 'D', should show D badge
    await expect(page.getByText('D').first()).toBeVisible()
  })

  test('Load Case dropdown is present when adding a load', async ({ page }) => {
    await page.getByRole('button', { name: 'Load' }).click()
    await expect(page.getByText('Load Case')).toBeVisible()
    await expect(page.locator('select').filter({ hasText: 'Dead (D)' })).toBeVisible()
  })

  test('can change load case via dropdown and save', async ({ page }) => {
    await page.getByRole('button', { name: 'Load' }).click()
    // Click PL1 to edit it
    await page.getByText('PL1').click()
    // Change load case to Wind
    await page.selectOption('select:near(:text("Load Case"))', 'W')
    await page.getByRole('button', { name: 'Update Load' }).click()
    // W badge should now appear
    await expect(page.getByText('W').first()).toBeVisible()
  })
})

test.describe('Load Cases — add custom combination', () => {
  test('can add a custom combination', async ({ page }) => {
    await page.goto('/workspace')
    await page.getByRole('button', { name: 'Combo' }).click()
    await page.getByRole('button', { name: '＋ New Combination' }).click()
    await page.locator('input[placeholder="Combination name"]').fill('My Custom 2.0D')
    // Set factor case to D and factor to 2.0
    await page.locator('input[type="number"]').first().fill('2.0')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('My Custom 2.0D').first()).toBeVisible()
  })
})

test.describe('Load Cases — analysis integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupSession(page)
  })

  test('analysis banner shows combination name after run', async ({ page }) => {
    // Select a combination
    await page.getByRole('button', { name: 'Combo' }).click()
    await page.getByText('1.2D + 1.6L').click()
    // Run analysis
    await page.getByRole('button', { name: '▶ Run' }).click()
    // Navigate to analysis page
    await page.getByRole('link', { name: 'Analysis' }).click()
    await expect(page.getByText('Load combination:')).toBeVisible()
    await expect(page.getByText('1.2D + 1.6L')).toBeVisible()
  })

  test('report shows Load Combinations section', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Run' }).click()
    await page.getByRole('link', { name: 'Report' }).click()
    await expect(page.getByText('6. Load Combinations')).toBeVisible()
    await expect(page.getByText('7. Applied Loads')).toBeVisible()
  })

  test('report Applied Loads table has Case column', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Run' }).click()
    await page.getByRole('link', { name: 'Report' }).click()
    await expect(page.getByRole('columnheader', { name: 'Case' })).toBeVisible()
  })
})
