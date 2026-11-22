import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, acceptDownloads: true })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.click('.ocr-link')
await page.waitForSelector('.ocr-modal')
await page.setInputFiles('.ocr-modal input[type=file]', 'C:/Users/lenovo/Documents/عارف ابراهيم/عارف البحث كامل.pdf')
await page.fill('#ocr-topic', 'تقدير الذات')
await page.click('.ocr-range .segmented-mini button:nth-child(2)')
await page.fill('.ocr-range input.ocr-range-input', '8')
await page.click('.ocr-actions .button-primary')
await page.waitForSelector('.ocr-result', { timeout: 300000 })
console.log('result=', (await page.locator('.ocr-result').textContent())?.replace(/\s+/g,' ').trim().slice(0, 260))
const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.ocr-result .button-primary').click()])
const target = path.join(root, 'tests/outputs/arif-page8-ocr.pdf')
await download.saveAs(target)
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(target)) }).promise
console.log('pdf pages=', doc.numPages, 'filename=', download.suggestedFilename())
const p = await doc.getPage(1); const tc = await p.getTextContent(); console.log('pdf text sample=', tc.items.filter(i=>i.str).map(i=>i.str).join(' ').slice(0,200))
console.log('errors=', errors)
await browser.close()
