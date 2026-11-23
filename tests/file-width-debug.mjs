import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 1000 }, isMobile: true })
const files = [
  { name: 'دور+القيادة+التحويلية+في+الأداء+المؤسسي+والابتكار+التنظيمي+دراسة+ميدانية+طويلة+جدا.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(path.join(root, 'tests/fixtures/study1.pdf')) },
  { name: 'واقع+تطبيق+القيادة+التحويلية+في+القطاع+العام+الجزائري+دراسة+تحليلية+موسعة.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(path.join(root, 'tests/fixtures/study2.pdf')) },
  { name: 'أثر+القيادة+التحويلية+على+الرضا+الوظيفي+والأداء+المؤسسي+في+الجامعات.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(path.join(root, 'tests/fixtures/soltani.pdf')) },
]
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', files)
await page.waitForTimeout(300)
await page.click('.file-list-toggle')
await page.waitForTimeout(300)
const info = await page.evaluate(() => {
  const sels = ['.workbench-grid', '.panel', '.uploader', '.file-list', '.file-row', '.file-meta', '.file-name']
  return sels.map((sel) => {
    const el = document.querySelector(sel)
    if (!el) return { sel, missing: true }
    const r = el.getBoundingClientRect()
    const c = getComputedStyle(el)
    return { sel, x: r.x, width: r.width, scrollWidth: el.scrollWidth, minWidth: c.minWidth, display: c.display, flex: c.flex, grid: c.gridTemplateColumns }
  })
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
