import { test, expect } from '@playwright/test'

// Member with TIS H 100×100 profile (id: TIS-H-100x100-v1, mass: 17.2 kg/m)
const SESSION = JSON.stringify({
  nodes: [
    { id: 'n1', x: 0, y: 0, support: 'pinned', label: 'N1' },
    { id: 'n2', x: 5, y: 0, support: 'roller', label: 'N2' },
  ],
  members: [
    {
      id: 'm1',
      startNodeId: 'n1',
      endNodeId: 'n2',
      steelProfileId: 'TIS-H-100x100-v1',
      E: 200000,
      A: 2190,
      I: 3830000,
      isTruss: false,
      label: 'M1',
    },
  ],
  structureType: 'frame',
  loads: [],
  savedAt: new Date().toISOString(),
})

const SESSION_NO_PROFILE = JSON.stringify({
  nodes: [
    { id: 'n1', x: 0, y: 0, support: 'pinned', label: 'N1' },
    { id: 'n2', x: 5, y: 0, support: 'roller', label: 'N2' },
  ],
  members: [
    { id: 'm1', startNodeId: 'n1', endNodeId: 'n2', E: 200000, A: 5000, I: 10000000, isTruss: false, label: 'M1' },
  ],
  structureType: 'frame',
  loads: [],
  savedAt: new Date().toISOString(),
})

async function loadSession(page: Parameters<typeof test>[1], session = SESSION) {
  await page.goto('/workspace')
  await page.evaluate((s) => localStorage.setItem('structcalc_session', s), session)
  await page.reload()
  const btn = page.getByRole('button', { name: 'Continue' })
  if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) await btn.click()
}

test.describe('Self-weight generation', () => {
  test('⚖ Self-weight button is visible in Load tab panel', async ({ page }) => {
    await loadSession(page)
    await page.getByRole('button', { name: 'Load' }).click()
    await expect(page.getByTestId('generate-self-weight')).toBeVisible()
  })

  test('clicking Self-weight generates SW load visible in Load tab', async ({ page }) => {
    await loadSession(page)

    // Switch to Load tab first
    await page.getByRole('button', { name: 'Load' }).click()

    // Generate self-weight
    await page.getByRole('button', { name: /Self-weight/i }).click()

    // SW-M1 load should appear in the load list
    await expect(page.getByText('SW-M1')).toBeVisible()
  })

  test('SW load is tagged as Dead (D) load case', async ({ page }) => {
    await loadSession(page)
    await page.getByRole('button', { name: 'Load' }).click()
    await page.getByRole('button', { name: /Self-weight/i }).click()

    // Load list row contains both the 'D' badge and 'SW-M1' label
    await expect(page.locator('.truncate', { hasText: 'SW-M1' })).toBeVisible()
    // D badge is the loadCase indicator (bg-slate-200 for Dead)
    const loadRow = page.locator('.bg-slate-50', { hasText: 'SW-M1' }).first()
    await expect(loadRow).toContainText('D')
  })

  test('clicking Self-weight twice does not duplicate loads', async ({ page }) => {
    await loadSession(page)
    await page.getByRole('button', { name: 'Load' }).click()

    await page.getByRole('button', { name: /Self-weight/i }).click()
    await page.getByRole('button', { name: /Self-weight/i }).click()

    // Should still be exactly 1 SW load row (use the truncate span inside load list)
    const swItems = page.locator('.truncate', { hasText: 'SW-M1' })
    await expect(swItems).toHaveCount(1)
  })

  test('does not generate SW load for member without steel profile', async ({ page }) => {
    await loadSession(page, SESSION_NO_PROFILE)
    await page.getByRole('button', { name: 'Load' }).click()
    await page.getByRole('button', { name: /Self-weight/i }).click()

    // No SW loads should appear
    await expect(page.getByText(/SW-/)).not.toBeVisible()
  })

  test('SW load persists after navigating away and back', async ({ page }) => {
    await loadSession(page)
    await page.getByRole('button', { name: 'Load' }).click()
    await page.getByRole('button', { name: /Self-weight/i }).click()

    // Navigate away
    await page.getByRole('link', { name: /Analysis/i }).click()
    await page.waitForURL('/analysis')

    // Navigate back
    await page.getByRole('link', { name: /Workspace/i }).click()
    await page.waitForURL('/workspace')

    // Switch to Load tab again
    await page.getByRole('button', { name: 'Load' }).click()
    await expect(page.getByText('SW-M1')).toBeVisible()
  })
})
