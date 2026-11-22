import { chromium } from 'playwright-core'
import path from 'node:path'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } })
const file = 'file:///' + path.resolve(process.argv[2]).replace(/\\/g, '/')
await page.goto(file, { waitUntil: 'load' })
await page.waitForTimeout(1800)
await page.screenshot({ path: 'muqtataf/tests/screenshots/18-source-pdf.png' })
await browser.close()
