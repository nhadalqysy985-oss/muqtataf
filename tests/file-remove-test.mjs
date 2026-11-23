import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
console.log('FILES_BEFORE=', await page.locator('.file-row').count())
await page.click('.file-remove')
console.log('FILES_AFTER=', await page.locator('.file-row').count())
await browser.close()
