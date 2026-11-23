import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 1600 }, isMobile: true })
const files = [
  { name: 'دور+القيادة+التحويلية+في+الأداء+المؤسسي+والابتكار+التنظيمي+دراسة+ميدانية+طويلة+جدا.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(path.join(root, 'tests/fixtures/study1.pdf')) },
  { name: 'واقع+تطبيق+القيادة+التحويلية+في+القطاع+العام+الجزائري+دراسة+تحليلية+موسعة.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(path.join(root, 'tests/fixtures/study2.pdf')) },
  { name: 'أثر+القيادة+التحويلية+على+الرضا+الوظيفي+والأداء+المؤسسي+في+الجامعات.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(path.join(root, 'tests/fixtures/soltani.pdf')) },
]
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', files)
await page.waitForTimeout(300)
console.log('COLLAPSED_ROWS=', await page.locator('.file-row').count())
console.log('TOGGLE_TEXT=', (await page.locator('.file-list-toggle').textContent())?.replace(/\s+/g, ' ').trim())
await page.screenshot({ path: path.join(root, 'tests/screenshots/35-files-collapsed.png'), fullPage: false })
await page.click('.file-list-toggle')
await page.waitForTimeout(300)
console.log('EXPANDED_ROWS=', await page.locator('.file-row').count())
const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
console.log('OVERFLOW=', overflow)
const rowBox = await page.locator('.file-row').first().boundingBox()
const nameBox = await page.locator('.file-name').first().boundingBox()
console.log('ROW_BOX=', rowBox)
console.log('NAME_BOX=', nameBox)
console.log('NAME_TEXT=', (await page.locator('.file-name').first().textContent())?.slice(0, 40))
await page.screenshot({ path: path.join(root, 'tests/screenshots/36-files-expanded.png'), fullPage: false })
await browser.close()
