import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'القيادة التحويلية')
await page.fill('.api-input input', 'sk-invalid')
await page.click('button.start-button')
await page.waitForSelector('.failures', { timeout: 30000 })
console.log('failure=', (await page.locator('.failures').textContent())?.replace(/\s+/g,' ').trim())
console.log('usage=', (await page.locator('.usage-panel').textContent())?.replace(/\s+/g,' ').trim())
await browser.close()
