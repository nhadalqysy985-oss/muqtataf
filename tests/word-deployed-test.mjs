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
await page.goto('https://nhadalqysy985-oss.github.io/muqtataf/', { waitUntil: 'networkidle' })

console.log('word checked=', await page.locator('.word-toggle input').isChecked())
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'مفهوم القيادة التحويلية')
await page.click('button.start-button')
await page.waitForSelector('.result-card', { timeout: 120000 })
console.log('pdf badge=', (await page.locator('.result-badge').textContent())?.trim())
console.log('word button=', await page.locator('.result-card a.button-word').count())
await page.screenshot({ path: path.join(root, 'tests/screenshots/13-word-option.png'), fullPage: false })

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('.result-card a.button-word').click(),
])
const docxPath = path.join(root, 'tests/outputs/study1-word.docx')
await download.saveAs(docxPath)
console.log('word filename=', download.suggestedFilename(), 'bytes=', fs.statSync(docxPath).size)

const zip = await JSZip.loadAsync(fs.readFileSync(docxPath))
const names = Object.keys(zip.files)
console.log('docx entries=', names.filter((n) => n.startsWith('word/')).slice(0, 20))
const documentXml = await zip.file('word/document.xml').async('string')
const sectionCount = (documentXml.match(/<w:sectPr/g) ?? []).length
const text = [...documentXml.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map((m) => m[1]).join(' ')
console.log('sections=', sectionCount, 'bidi=', (documentXml.match(/<w:bidi/g) ?? []).length, 'rtl=', (documentXml.match(/<w:rtl/g) ?? []).length)
console.log('text sample=', text.slice(0, 500))
const footerFiles = names.filter((n) => /^word\/footer\d+\.xml$/.test(n))
for (const file of footerFiles) {
  const xml = await zip.file(file).async('string')
  const footerText = [...xml.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map((m) => m[1]).join(' ')
  console.log('footer', file, '=>', footerText)
}
console.log('errors=', errors)
await browser.close()

