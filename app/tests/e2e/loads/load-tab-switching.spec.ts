import { test, expect } from '@playwright/test'

async function waitForCanvas(page: Parameters<typeof test>[1] extends (...args: infer A) => unknown ? A[1] : never) {
  await page.locator('#structure-canvas canvas').waitFor({ state: 'attached', timeout: 8000 })
}

test.describe('Load Tab Auto-switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace')
    await waitForCanvas(page)
    const resumeBtn = page.getByRole('button', { name: 'Start New' })
    if (await resumeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await resumeBtn.click()
    }
  })

  test('pressing L key switches panel to Load tab', async ({ page }) => {
    // Default tab is Node; pressing 'l' enters ADD_POINT_LOAD mode → Load tab auto-switches
    await page.keyboard.press('l')
    await page.waitForTimeout(200)

    // "Add Load" button is inside LoadPanel which is only shown on Load tab
    await expect(page.locator('button:has-text("Add Load")')).toBeVisible({ timeout: 2000 })
  })

  test('clicking a point load in the list switches to edit mode (Update Load)', async ({ page }) => {
    // Add a node
    await page.keyboard.press('n')
    await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(100)

    // Add a point load
    await page.keyboard.press('l')
    await page.click('#structure-canvas', { position: { x: 350, y: 300 } })
    await page.waitForTimeout(300)

    const addBtn = page.locator('button:has-text("Add Load")').first()
    if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.click()
      await page.waitForTimeout(300)
    }

    // PL1 should appear in the load list
    await expect(page.locator('text=PL1')).toBeVisible({ timeout: 3000 })

    // Click PL1 in the load list to enter edit mode
    await page.locator('text=PL1').click()
    await page.waitForTimeout(200)

    // Panel should now show "Update Load" button (edit mode)
    await expect(page.locator('button:has-text("Update Load")')).toBeVisible({ timeout: 2000 })
  })
})
