import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.fill('.api-input input', 'sk-demo')
await page.locator('#tool').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await page.screenshot({ path: 'muqtataf/docs/screenshot-desktop.png', fullPage: false })
await browser.close()
