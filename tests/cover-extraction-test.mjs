import { chromium } from 'playwright-core'
import path from 'node:path'
const root = path.resolve('muqtataf')
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } })
await page.route('https://api.deepseek.com/v1/tools/ocr', async (route) => {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'authorization' } })
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ page_count: 2, pages: [
    { index: 0, text: '**دور القيادة التحويلية**\n<tr><td>في الأداء المؤسسي</td></tr>\nأحمد علي\nجامعة بغداد\nكلية الإدارة والاقتصاد\nISSN: 2074-5621\nالمجلد 12، العدد 3، صفحة 2019\n2024', finish_reason: 'stop' },
    { index: 1, text: '112\nالقيادة التحويلية\nنص الصفحة.', finish_reason: 'stop' },
  ], usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 } }) })
})
await page.goto('http://127.0.0.1:4178/', { waitUntil: 'networkidle' })
await page.setInputFiles('input[type=file]', path.join(root, 'tests/fixtures/study1.pdf'))
await page.fill('#topic', 'القيادة التحويلية')
await page.fill('.api-input input', 'sk-mock')
await page.click('button.start-button')
await page.waitForSelector('.result-card', { timeout: 60000 })
console.log('TITLE=', (await page.locator('.result-ident h3').textContent())?.trim())
console.log('AUDIT=', (await page.locator('.cover-audit').textContent())?.replace(/\s+/g, ' ').trim())
console.log('META=', (await page.locator('.result-meta').textContent())?.replace(/\s+/g, ' ').trim())
console.log('WARNING_COUNT=', await page.locator('.result-meta-warning').count())
await browser.close()
