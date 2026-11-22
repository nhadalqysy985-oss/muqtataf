import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'
import JSZip from 'jszip'

const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, acceptDownloads: true })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })

// Disable Word and ensure PDF path still works.
await page.uncheck('.word-toggle input')
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study2.pdf'))
await page.fill('#topic', 'القيادة التحويلية')
await page.click('button.start-button')
await page.waitForSelector('.result-card', { timeout: 120000 })
console.log('word-off buttons=', await page.locator('.result-card a.button-word').count())
console.log('pdf pages=', await page.locator('.page-chip:not(.is-cover)').allTextContents())
await page.close()

// Scanned PDF with Word enabled.
const page2 = await browser.newPage({ viewport: { width: 1200, height: 1000 }, acceptDownloads: true })
page2.on('pageerror', (e) => errors.push(e.message))
await page2.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page2.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/scanned.pdf'))
await page2.fill('#topic', 'القيادة التحويلية')
await page2.click('button.start-button')
await page2.waitForSelector('.result-card', { timeout: 120000 })
console.log('scanned word button=', await page2.locator('.result-card a.button-word').count())
const [wordDownload] = await Promise.all([page2.waitForEvent('download'), page2.locator('.result-card a.button-word').click()])
const scannedDocx = path.join(root, 'tests/outputs/scanned-word.docx')
await wordDownload.saveAs(scannedDocx)
const zip = await JSZip.loadAsync(fs.readFileSync(scannedDocx))
const xml = await zip.file('word/document.xml').async('string')
console.log('scanned sections=', (xml.match(/<w:sectPr/g) ?? []).length)
console.log('scanned placeholder=', xml.includes('لا يوجد نص قابل للاستخراج'))
const footer = Object.keys(zip.files).find((n) => /^word\/footer\d+\.xml$/.test(n))
console.log('scanned footer=', footer ? [...(await zip.file(footer).async('string')).matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map((m) => m[1]).join(' ') : 'none')
console.log('errors=', errors)
await browser.close()
