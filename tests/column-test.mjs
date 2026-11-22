import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'
import JSZip from 'jszip'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', 'C:/Users/lenovo/Downloads/I3LEM202303503.pdf')
await page.fill('#topic', 'إدارة المعرفة')
await page.click('.segmented-mini button:nth-child(2)')
await page.click('button.start-button')
await page.waitForSelector('.result-card', { timeout: 240000 })
console.log('badge=', (await page.locator('.result-badge').textContent())?.trim())
const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.result-card a.button-word').click()])
const target = path.join(root, 'tests/outputs/i3lem-columns.docx')
await download.saveAs(target)
const zip = await JSZip.loadAsync(fs.readFileSync(target))
const xml = await zip.file('word/document.xml').async('string')
const paragraphs = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => [...m[0].matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map((t) => t[1]).join('')).filter(Boolean)
console.log('sections=', (xml.match(/<w:sectPr/g) ?? []).length, 'paragraphs=', paragraphs.length)
console.log('FIRST PAGE PARAGRAPHS:')
for (const p of paragraphs.slice(0, 14)) console.log('-', p.slice(0, 200))
console.log('errors=', errors)
await browser.close()
