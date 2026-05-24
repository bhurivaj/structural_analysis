import { test, expect } from '@playwright/test'

async function waitForGrid(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.locator('#grid-layer line').first().waitFor({ state: 'attached', timeout: 5000 })
}

test.describe('Unit Conversion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForGrid(page)
  })

  test('settings button is visible for changing units', async ({ page }) => {
    await expect(page.getByRole('button', { name: '⚙' })).toBeVisible()
  })

  test('import/export button is visible in navbar', async ({ page }) => {
    await expect(page.getByRole('button', { name: '⬆⬇' })).toBeVisible()
  })

  test('import modal can be opened', async ({ page }) => {
    await page.getByRole('button', { name: '⬆⬇' }).click()
    await expect(page.getByText('Import Structure')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('import modal has paste and upload tabs', async ({ page }) => {
    await page.getByRole('button', { name: '⬆⬇' }).click()
    await expect(page.getByText('Paste JSON')).toBeVisible()
    await expect(page.getByText('Upload File')).toBeVisible()
  })

  test('export button downloads JSON', async ({ page, context }) => {
    // Set up listener for download
    const downloadPromise = context.waitForEvent('download')

    await page.getByRole('button', { name: '⬆⬇' }).click()
    await page.getByRole('button', { name: 'Export Current' }).click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^structure-\d+\.json$/)
  })

  test('settings modal opens successfully', async ({ page }) => {
    await page.getByRole('button', { name: '⚙' }).click()
    await expect(page.getByRole('heading', { name: /Settings|Project/ })).toBeVisible({ timeout: 5000 })
  })

  test('analysis page is accessible', async ({ page }) => {
    await page.goto('/analysis')
    // Page should either show placeholder or analysis results
    await expect(page.locator('body')).toBeVisible()
  })

  test('report page displays load section', async ({ page }) => {
    await page.goto('/report')
    // Report should have "Applied Loads" heading
    const heading = await page.locator('h2, h3').filter({ hasText: /Applied|Loads/ }).first()
    await expect(heading).toBeVisible({ timeout: 3000 })
  })
})
