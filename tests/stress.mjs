import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'
import JSZip from 'jszip'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
const files = Array.from({ length: 8 }, (_, i) => path.join(root, 'tests', 'fixtures', `copy-${i + 1}.pdf`))
await page.setInputFiles('input[type=file]', files)
await page.fill('#topic', 'مفهوم القيادة التحويلية')
await page.click('button.start-button')
await page.waitForFunction(() => document.querySelectorAll('.result-card').length === 8, null, { timeout: 240000 })
console.log('cards=', await page.locator('.result-card').count())
console.log('done=', (await page.locator('.done-banner').textContent())?.replace(/\s+/g, ' ').trim())
const [download] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("تنزيل الكل ZIP")')])
const zipPath = path.join(root, 'tests', 'outputs', 'stress.zip')
await download.saveAs(zipPath)
const zip = await JSZip.loadAsync(fs.readFileSync(zipPath))
console.log('zip entries=', Object.keys(zip.files).length)
console.log('errors=', errors)
await page.screenshot({ path: path.join(root, 'tests', 'screenshots', '12-stress.png'), fullPage: false })
await browser.close()
