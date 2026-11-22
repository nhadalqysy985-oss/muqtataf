import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } })
page.on('console', (m) => console.log('CONSOLE', m.type(), m.text()))
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
await page.goto('http://127.0.0.1:4178/tests/layout-debug.html?file=study1.pdf&page=8', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
console.log((await page.locator('#out').textContent())?.slice(0, 6000))
await browser.close()

