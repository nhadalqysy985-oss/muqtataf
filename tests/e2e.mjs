import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const root = path.resolve('muqtataf')
const outDir = path.join(root, 'tests', 'outputs')
const shotDir = path.join(root, 'tests', 'screenshots')
const files = [
  path.join(root, 'tests', 'fixtures', 'study1.pdf'),
  path.join(root, 'tests', 'fixtures', 'study2.pdf'),
  path.join(root, '..', 'demo', 'رسالة_تجريبية.pdf'),
]

const browser = await chromium.launch({ executablePath: chrome, headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'ar-IQ',
  acceptDownloads: true,
})
const page = await context.newPage()
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
})
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))

await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.screenshot({ path: path.join(shotDir, '01-home-desktop.png'), fullPage: true })

await page.setInputFiles('input[type=file]', files)
await page.waitForFunction(() => document.querySelectorAll('.file-row').length === 3)
await page.fill('#topic', 'مفهوم القيادة التحويلية')
await page.screenshot({ path: path.join(shotDir, '02-filled-desktop.png'), fullPage: true })

await page.click('button.start-button')
await page.waitForSelector('#results', { timeout: 180000 })
await page.waitForSelector('.result-card', { timeout: 30000 })
await page.waitForTimeout(1200)
await page.screenshot({ path: path.join(shotDir, '03-results-desktop.png'), fullPage: true })

const cards = await page.$$eval('.result-card', (nodes) =>
  nodes.map((card) => ({
    title: card.querySelector('h3')?.textContent?.trim() ?? '',
    authors: [...card.querySelectorAll('.result-meta span')].map((node) => node.textContent?.trim()),
    badge: card.querySelector('.result-badge')?.textContent?.trim() ?? '',
    pages: [...card.querySelectorAll('.page-chip:not(.is-cover)')].map((node) => node.textContent?.trim()),
    warning: card.querySelector('.result-warning')?.textContent?.trim() ?? '',
    snippet: card.querySelector('.snippet p')?.textContent?.trim() ?? '',
  })),
)
console.log('CARDS:', JSON.stringify(cards, null, 2))

const downloadLinks = await page.$$('.result-card a[download]')
for (let index = 0; index < downloadLinks.length; index += 1) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    downloadLinks[index].click(),
  ])
  const target = path.join(outDir, `result-${index + 1}.pdf`)
  await download.saveAs(target)
  const bytes = new Uint8Array(fs.readFileSync(target))
  const doc = await getDocument({ data: bytes }).promise
  const pageTexts = []
  for (let n = 1; n <= doc.numPages; n += 1) {
    const p = await doc.getPage(n)
    const tc = await p.getTextContent()
    pageTexts.push(tc.items.filter((i) => i.str).map((i) => i.str).join(' ').slice(0, 120))
  }
  console.log(`PDF ${index + 1}: ${doc.numPages} pages, suggested=${download.suggestedFilename()}`)
  console.log(pageTexts.map((text, i) => `  p${i + 1}: ${text}`).join('\n'))
}

await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(400)
await page.screenshot({ path: path.join(shotDir, '04-results-mobile.png'), fullPage: true })

console.log('ERRORS:', JSON.stringify(errors, null, 2))
await browser.close()

