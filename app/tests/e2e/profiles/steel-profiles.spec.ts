import { test, expect } from '@playwright/test'

test.describe('Steel Profile database', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profiles')
  })

  test('loads TIS H-beam profiles', async ({ page }) => {
    await expect(page.getByText('H 100×100×8×6')).toBeVisible()
    await expect(page.getByText('H 400×400×21×13')).toBeVisible()
  })

  test('filters by standard', async ({ page }) => {
    await page.getByRole('button', { name: 'TIS' }).click()
    await expect(page.getByText('H 150×150×10×7')).toBeVisible()
  })

  test('search by designation', async ({ page }) => {
    await page.getByPlaceholder('Search designation...').fill('200×200')
    await expect(page.getByText('H 200×200×12×8')).toBeVisible()
    await expect(page.getByText('H 100×100×8×6')).not.toBeVisible()
  })

  test('shows profile detail on click', async ({ page }) => {
    await page.getByText('H 200×200×12×8').first().click()
    await expect(page.getByText('H 200×200×12×8').last()).toBeVisible()
    await expect(page.getByText('TIS · H-section')).toBeVisible()
  })
})
