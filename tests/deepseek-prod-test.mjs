import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto('http://127.0.0.1:4179/', { waitUntil: 'networkidle' })
console.log('api panel=', await page.locator('.api-panel').count())
console.log('start disabled=', await page.locator('button.start-button').isDisabled())
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'القيادة التحويلية')
await page.fill('.api-input input', 'sk-test')
console.log('start with key disabled=', await page.locator('button.start-button').isDisabled())
await page.click('button.start-button')
await page.waitForSelector('.failures', { timeout: 30000 })
console.log('failure=', (await page.locator('.failures').textContent())?.replace(/\s+/g,' ').trim().slice(0, 300))
console.log('errors=', errors)
await page.screenshot({ path: path.join(root, 'tests/screenshots/23-deepseek-key.png'), fullPage: false })
await browser.close()

