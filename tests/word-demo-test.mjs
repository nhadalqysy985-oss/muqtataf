import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'
import JSZip from 'jszip'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, acceptDownloads: true })
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, '..', 'demo', 'رسالة_تجريبية.pdf'))
await page.fill('#topic', 'مفهوم القيادة التحويلية')
await page.click('button.start-button')
await page.waitForSelector('.result-card', { timeout: 120000 })
const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.result-card a.button-word').click()])
const target = path.join(root, 'tests/outputs/demo-word.docx')
await download.saveAs(target)
const zip = await JSZip.loadAsync(fs.readFileSync(target))
const xml = await zip.file('word/document.xml').async('string')
const text = [...xml.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map((m) => m[1]).join(' ').replace(/\s+/g, ' ').trim()
console.log('title=', (await page.locator('.result-card h3').textContent())?.trim())
console.log('author=', (await page.locator('.result-meta span').nth(1).textContent())?.trim())
console.log('word text=', text.slice(0, 600))
await browser.close()
