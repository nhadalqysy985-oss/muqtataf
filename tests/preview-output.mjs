import { chromium } from 'playwright-core'
import path from 'node:path'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } })
const file = 'file:///' + path.resolve('muqtataf/tests/outputs/result-1.pdf').replace(/\\/g, '/')
await page.goto(file, { waitUntil: 'load' })
await page.waitForTimeout(2500)
console.log('url', page.url(), 'title', await page.title())
await page.screenshot({ path: 'muqtataf/tests/screenshots/05-output-pdf.png' })
await browser.close()
