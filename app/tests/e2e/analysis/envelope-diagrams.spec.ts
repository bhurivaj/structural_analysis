import { test, expect } from '@playwright/test'

const SESSION = JSON.stringify({
  nodes: [
    { id: 'n1', x: 0, y: 0, support: 'pinned', label: 'N1' },
    { id: 'n2', x: 4, y: 0, support: 'roller', label: 'N2' },
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

async function runAnalysisAndEnvelope(page: Parameters<typeof test>[1]) {
  await loadSession(page)
  await page.getByRole('button', { name: '▶ Run' }).click()
  await page.waitForTimeout(500)
  await page.locator('button', { hasText: '⊛ Envelope' }).click()
  await page.waitForTimeout(1000)
  await page.getByRole('link', { name: /Analysis/i }).click()
  await page.waitForURL('/analysis')
}

test.describe('Envelope N/V/M Diagrams', () => {
  test('DiagramPanel shows Active/Envelope toggle after envelope is run', async ({ page }) => {
    await runAnalysisAndEnvelope(page)

    const panel = page.getByTestId('diagram-panel')
    await expect(panel.getByRole('button', { name: 'Active' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Envelope' })).toBeVisible()
  })

  test('Active/Envelope toggle is NOT shown in DiagramPanel before envelope is run', async ({ page }) => {
    await loadSession(page)
    await page.getByRole('button', { name: '▶ Run' }).click()
    await page.waitForTimeout(500)
    await page.getByRole('link', { name: /Analysis/i }).click()
    await page.waitForURL('/analysis')

    const panel = page.getByTestId('diagram-panel')
    await expect(panel.getByRole('button', { name: 'Active' })).not.toBeVisible()
    await expect(panel.getByRole('button', { name: 'Envelope' })).not.toBeVisible()
  })

  test('switching to Envelope mode shows combo count', async ({ page }) => {
    await runAnalysisAndEnvelope(page)

    const panel = page.getByTestId('diagram-panel')
    await panel.getByRole('button', { name: 'Envelope' }).click()
    await expect(panel.getByText(/Envelope across/i)).toBeVisible()
  })

  test('Envelope SVG polygon (band) is rendered when Envelope mode is active', async ({ page }) => {
    await runAnalysisAndEnvelope(page)

    const panel = page.getByTestId('diagram-panel')
    await panel.getByRole('button', { name: 'Envelope' }).click()
    await expect(page.getByTestId('envelope-band')).toBeAttached()
  })

  test('switching back to Active removes the envelope polygon', async ({ page }) => {
    await runAnalysisAndEnvelope(page)

    const panel = page.getByTestId('diagram-panel')
    await panel.getByRole('button', { name: 'Envelope' }).click()
    await expect(page.getByTestId('envelope-band')).toBeAttached()

    await panel.getByRole('button', { name: 'Active' }).click()
    await expect(page.getByTestId('envelope-band')).not.toBeAttached()
  })

  test('Envelope mode works for N, V, and M diagram modes', async ({ page }) => {
    await runAnalysisAndEnvelope(page)

    const panel = page.getByTestId('diagram-panel')
    // Use exact text matching to avoid strict mode conflicts
    for (const mode of ['N', 'V', 'M']) {
      await panel.locator('button').filter({ hasText: new RegExp(`^${mode}$`) }).click()
      await panel.getByRole('button', { name: 'Envelope' }).click()
      await expect(page.getByTestId('envelope-band')).toBeAttached()
      await panel.getByRole('button', { name: 'Active' }).click()
    }
  })
})
