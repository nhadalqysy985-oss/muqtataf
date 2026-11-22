import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'
import JSZip from 'jszip'
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const errors = []
const failed = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`) })
await page.goto('https://nhadalqysy985-oss.github.io/muqtataf/', { waitUntil: 'networkidle', timeout: 60000 })
console.log('title=', await page.title(), 'ocr-link=', await page.locator('.ocr-link').count())
await page.click('.ocr-link')
console.log('ocr-modal=', await page.locator('.ocr-modal').isVisible())
await page.click('.ocr-head .icon-button')
await page.setInputFiles('input[type=file]', 'C:/Users/lenovo/Downloads/I3LEM202303503.pdf')
await page.fill('#topic', 'إدارة المعرفة')
await page.click('.segmented-mini button:nth-child(2)')
await page.click('button.start-button')
await page.waitForSelector('.result-card', { timeout: 240000 })
console.log('badge=', (await page.locator('.result-badge').textContent())?.trim())
console.log('quality=', (await page.locator('.quality-chip').textContent().catch(()=>''))?.trim())
const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.result-card a.button-word').click()])
const target = path.resolve('muqtataf/tests/outputs/deployed-i3lem.docx')
await download.saveAs(target)
const zip = await JSZip.loadAsync(fs.readFileSync(target))
const xml = await zip.file('word/document.xml').async('string')
const paragraphs = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => [...m[0].matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map((t) => t[1]).join('')).filter(Boolean)
console.log('sections=', (xml.match(/<w:sectPr/g) ?? []).length)
console.log('first=', paragraphs.slice(0, 8).map(p=>p.slice(0,90)))
console.log('failed=', failed.slice(0,5), 'errors=', errors.slice(0,5))
await page.screenshot({ path: 'muqtataf/tests/screenshots/22-deployed-final.png', fullPage: false })
await browser.close()
