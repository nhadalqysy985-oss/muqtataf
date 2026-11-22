import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto('http://127.0.0.1:4178/tests/docx-preview.html', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
console.log('title=', await page.title(), 'pages=', await page.locator('.docx-wrapper section').count(), 'errors=', errors)
await page.screenshot({ path: 'muqtataf/tests/screenshots/15-word-render.png', fullPage: true })
await browser.close()
