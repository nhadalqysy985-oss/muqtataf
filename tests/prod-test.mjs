import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto('http://127.0.0.1:4179/', { waitUntil: 'networkidle' })
console.log('title=', await page.title())
console.log('assets=', await page.evaluate(() => [...document.querySelectorAll('script,link')].map(e => e.src || e.href).filter(Boolean)))
await page.setInputFiles('input[type=file]', path.resolve('muqtataf/tests/fixtures/study2.pdf'))
await page.fill('#topic', 'القيادة التحويلية')
await page.click('button.start-button')
await page.waitForSelector('.result-card', { timeout: 120000 })
console.log('badge=', (await page.locator('.result-badge').textContent())?.trim())
console.log('pages=', await page.locator('.page-chip:not(.is-cover)').allTextContents())
const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.result-card a[download]').click()])
await download.saveAs('muqtataf/tests/outputs/prod-result.pdf')
console.log('download=', download.suggestedFilename(), fs.statSync('muqtataf/tests/outputs/prod-result.pdf').size)
console.log('errors=', errors)
await page.screenshot({ path: 'muqtataf/tests/screenshots/09-prod-results.png', fullPage: false })
await browser.close()
