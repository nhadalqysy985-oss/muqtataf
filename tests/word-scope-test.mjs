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

// All pages scope.
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study2.pdf'))
await page.fill('#topic', 'القيادة التحويلية')
await page.click('.segmented-mini button:nth-child(2)')
await page.click('button.start-button')
await page.waitForSelector('.result-card', { timeout: 120000 })
const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.result-card a.button-word').click()])
const allPath = path.join(root, 'tests/outputs/study2-all-word.docx')
await download.saveAs(allPath)
const zip = await JSZip.loadAsync(fs.readFileSync(allPath))
const documentXml = await zip.file('word/document.xml').async('string')
console.log('all-pages sections=', (documentXml.match(/<w:sectPr/g) ?? []).length)
const footers = Object.keys(zip.files).filter((n) => /^word\/footer\d+\.xml$/.test(n)).sort()
console.log('footer count=', footers.length)
for (const file of footers.slice(0, 4)) {
  const xml = await zip.file(file).async('string')
  console.log(file, [...xml.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map((m) => m[1]).join(' '))
}
await page.screenshot({ path: path.join(root, 'tests/screenshots/14-word-scope.png'), fullPage: false })

// ZIP should contain PDF + DOCX.
const [zipDownload] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("تنزيل الكل ZIP")')])
const zipPath = path.join(root, 'tests/outputs/word-bundle.zip')
await zipDownload.saveAs(zipPath)
const bundle = await JSZip.loadAsync(fs.readFileSync(zipPath))
console.log('bundle=', Object.keys(bundle.files))
console.log('errors=', errors)
await browser.close()
