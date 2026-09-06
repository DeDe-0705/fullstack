import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

// createBdd 提供与 Playwright test 打通的 Given/When/Then
// step 文本与 .feature 文件里的描述一一对应（中文关键字 假如/当/那么 会自动映射）
const { Given, When, Then } = createBdd()

Given('用户打开首页', async ({ page }) => {
  await page.goto('/')
})

Then('页面应显示标题 {string}', async ({ page }, title: string) => {
  // 用语义化定位器（heading role），而不是脆弱的 CSS 选择器
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
})

When('用户点击导航菜单 {string}', async ({ page }, menuLabel: string) => {
  await page.getByRole('menuitem', { name: menuLabel }).click()
})

Then('地址栏路径应变为 {string}', async ({ page }, path: string) => {
  await expect(page).toHaveURL(new RegExp(`${path}$`))
})

Then('页面应显示文本 {string}', async ({ page }, text: string) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible()
})
