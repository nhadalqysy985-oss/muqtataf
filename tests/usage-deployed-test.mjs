import { chromium } from 'playwright-core'
import path from 'node:path'
import fs from 'node:fs'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
    return
  }
  const body = {
    id: 'ocr-test', object: 'ocr.result', purpose: 'text_recognition', page_count: 3,
    pages: [
      { index: 0, text: 'جامعة بغداد\nتأثير وسائل التواصل الاجتماعي على تقدير الذات\nإعداد الطالب: عارف إبراهيم\n2026', finish_reason: 'stop' },
      { index: 1, text: 'المقدمة\nيتناول هذا البحث موضوع تقدير الذات وأثره على الصحة النفسية.', finish_reason: 'stop' },
      { index: 2, text: 'صفحة لا تتعلق بالموضوع المطلوب.', finish_reason: 'stop' },
    ],
    usage: { input_tokens: 1000, output_tokens: 200, total_tokens: 1200 },
  }
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
})

await page.goto('https://nhadalqysy985-oss.github.io/muqtataf/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'تقدير الذات')
await page.fill('.api-input input', 'sk-mock-test')
await page.click('.api-options input[type=checkbox]')
await page.click('button.start-button')
await page.waitForSelector('.result-card', { timeout: 60000 })
console.log('badge=', (await page.locator('.result-badge').textContent())?.trim())
console.log('pages=', await page.locator('.page-chip:not(.is-cover)').allTextContents())
console.log('usage=', (await page.locator('.usage-panel').textContent())?.replace(/\s+/g,' ').trim())
console.log('api-key note=', (await page.locator('.result-file-note').textContent())?.trim())
const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.result-card a[download]').click()])
const target = path.join(root, 'tests/outputs/usage-result.pdf')
await download.saveAs(target)
const doc = await getDocument({ data: new Uint8Array(fs.readFileSync(target)) }).promise
console.log('pdf pages=', doc.numPages)
await page.reload({ waitUntil: 'networkidle' })
console.log('key restored=', await page.inputValue('.api-input input'))
console.log('usage restored=', (await page.locator('.usage-panel').textContent())?.replace(/\s+/g,' ').trim())
console.log('errors=', errors)
await page.screenshot({ path: path.join(root, 'tests/screenshots/24-usage.png'), fullPage: false })
await browser.close()

