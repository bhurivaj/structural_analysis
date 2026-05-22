import { test, expect } from '@playwright/test'

test.describe('Steel Profile database', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profiles')
  })

  test('loads TIS H-beam profiles', async ({ page }) => {
    await expect(page.getByText('H 100×100×6×8')).toBeVisible()
    await expect(page.getByText('H 400×400×13×21')).toBeVisible()
  })

  test('filters by standard', async ({ page }) => {
    await page.getByRole('button', { name: 'TIS' }).click()
    await expect(page.getByText('H 150×150×7×10')).toBeVisible()
  })

  test('search by designation', async ({ page }) => {
    await page.getByPlaceholder('Search designation...').fill('200')
    await expect(page.getByText('H 200×200×8×12')).toBeVisible()
    await expect(page.getByText('H 100×100×6×8')).not.toBeVisible()
  })

  test('shows profile detail on click', async ({ page }) => {
    await page.getByText('H 200×200×8×12').click()
    await expect(page.getByText('H 200×200×8×12').last()).toBeVisible()
    await expect(page.getByText('TIS · H-section')).toBeVisible()
  })
})
