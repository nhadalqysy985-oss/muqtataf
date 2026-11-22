import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.locator('#tool').scrollIntoViewIfNeeded()
await page.screenshot({ path: 'muqtataf/docs/screenshot-desktop.png', fullPage: false })
await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({ path: 'muqtataf/docs/screenshot-mobile.png', fullPage: false })
await browser.close()
