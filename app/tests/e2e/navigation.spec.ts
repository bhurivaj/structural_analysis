import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('loads workspace by default', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/workspace')
    await expect(page.getByText('StructCalc')).toBeVisible()
  })

  test('navigates to all views', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Steel Profiles' }).click()
    await expect(page).toHaveURL('/profiles')

    await page.getByRole('link', { name: 'Analysis' }).click()
    await expect(page).toHaveURL('/analysis')

    await page.getByRole('link', { name: 'Report' }).click()
    await expect(page).toHaveURL('/report')

    await page.getByRole('link', { name: 'Workspace' }).click()
    await expect(page).toHaveURL('/workspace')
  })
})
