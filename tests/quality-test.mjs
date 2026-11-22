import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', 'C:/Users/lenovo/Downloads/fahem,+44تيسيروصفاء605-625 — مقتطف.pdf')
await page.fill('#topic', 'القيادة التحويلية')
await page.click('button.start-button')
await page.waitForSelector('.result-card', { timeout: 120000 })
console.log('quality chip=', (await page.locator('.quality-chip').textContent().catch(()=>''))?.trim())
console.log('warning=', (await page.locator('.result-warning').textContent().catch(()=>''))?.replace(/\s+/g,' ').trim())
console.log('title=', (await page.locator('.result-card h3').textContent())?.trim())
console.log('errors=', errors)
await page.screenshot({ path: path.join(root, 'tests/screenshots/19-quality-warning.png'), fullPage: false })
await browser.close()
