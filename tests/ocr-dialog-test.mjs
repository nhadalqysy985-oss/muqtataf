import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'
import JSZip from 'jszip'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, acceptDownloads: true })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.click('.ocr-link')
await page.waitForSelector('.ocr-modal')
await page.setInputFiles('.ocr-modal input[type=file]', 'C:/Users/lenovo/Downloads/fahem,+44تيسيروصفاء605-625 — مقتطف.pdf')
await page.screenshot({ path: path.join(root, 'tests/screenshots/20-ocr-dialog.png'), fullPage: false })
await page.click('.ocr-actions .button-primary')
await page.waitForSelector('.ocr-result', { timeout: 300000 })
console.log('result=', (await page.locator('.ocr-result').textContent())?.replace(/\s+/g,' ').trim().slice(0, 200))
console.log('preview=', (await page.locator('.ocr-preview').textContent())?.slice(0, 500))
const [download] = await Promise.all([page.waitForEvent('download'), page.click('.ocr-result .button-primary')])
const target = path.join(root, 'tests/outputs/fahem-ocr.docx')
await download.saveAs(target)
const zip = await JSZip.loadAsync(fs.readFileSync(target))
const xml = await zip.file('word/document.xml').async('string')
const sections = (xml.match(/<w:sectPr/g) ?? []).length
const text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>(.*?)<\/w:t>/g)].map((m) => m[1]).join(' ')
console.log('docx sections=', sections, 'text=', text.slice(0, 600))
console.log('errors=', errors)
await browser.close()
